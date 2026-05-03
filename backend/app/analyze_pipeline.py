from typing import Any

from app.github_fetch import fetch_github_bundle, github_validation_scorer
from app.image_card import build_image_card
from app.linkedin_trust import badge_for_ui, linkedin_profile_builder, trust_level_for_ui, trust_score_engine
from app.mistral_gen import call_mistral_and_merge
from app.settings import settings
from app.tech_stack import extract_tech_and_context
from app.url_parse import parse_github_linkedin

from langgraph.graph import END, StateGraph


def rejection_response(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "rejected",
        "trust_score": data.get("trust_score"),
        "score_breakdown": data.get("score_breakdown"),
        "rejection_reason": data.get("rejection_reason"),
        "repo_meta": data.get("repo_meta"),
        "linkedin_profile": data.get("linkedin_profile"),
    }


def final_success_response(data: dict[str, Any]) -> dict[str, Any]:
    rm = data.get("repo_meta") or {}
    gp = data.get("generated_posts") or {}
    rs = gp.get("recruiter_score") or {}

    return {
        "status": "success",
        "trust": {
            "score": data.get("trust_score"),
            "level": trust_level_for_ui(str(data.get("trust_level") or "")),
            "badge": badge_for_ui(str(data.get("trust_badge") or "")),
            "breakdown": data.get("score_breakdown"),
        },
        "profile": {
            "github": {
                "repo_name": rm.get("name"),
                "description": rm.get("description") or "",
                "language": rm.get("language") or "",
                "stars": rm.get("stars") or 0,
                "contributors": rm.get("contributor_count") or 0,
                "commits": rm.get("commit_count") or 0,
                "is_fork": bool(rm.get("is_fork")),
                "url": data.get("github_url") or "",
            },
            "linkedin": data.get("linkedin_profile") or {},
        },
        "tech_stack": data.get("tech_stack") or {},
        "tech_stack_flat": data.get("tech_stack_flat") or [],
        "posts": {
            "technical": {**(gp.get("post_technical") or {}), "id": "technical"},
            "story": {**(gp.get("post_story") or {}), "id": "story"},
            "announcement": {**(gp.get("post_announcement") or {}), "id": "announcement"},
        },
        "recruiter_scores": {
            "technical_post": rs.get("technical_post") or 0,
            "story_post": rs.get("story_post") or 0,
            "announcement_post": rs.get("announcement_post") or 0,
            "reasoning": rs.get("reasoning") or "",
        },
        "image_card": data.get("image_card") or {},
        "generated_at": data.get("generation_timestamp") or "",
    }


PRIVATE_REPO_REJECTION: dict[str, Any] = {
    "status": "rejected",
    "rejection_reason": (
        "This GitHub repository doesn't exist or is private. "
        "DevPost Pro only works with public repositories."
    ),
    "trust_score": 0,
    "score_breakdown": {},
    "repo_meta": {},
    "linkedin_profile": {},
}


async def _node_parse(state: dict[str, Any]) -> dict[str, Any]:
    parsed = parse_github_linkedin(state["raw_body"])
    return parsed


async def _node_github(state: dict[str, Any]) -> dict[str, Any]:
    if not settings.github_token:
        raise RuntimeError("GITHUB_TOKEN is not configured on the backend.")
    repo_data, contributors, commits, readme_item, gh_err = await fetch_github_bundle(
        state["github_owner"],
        state["github_repo"],
        settings.github_token,
    )
    if gh_err == "private_or_missing":
        return {"final_response": PRIVATE_REPO_REJECTION.copy()}
    if gh_err == "github_auth_invalid":
        raise RuntimeError(
            "GitHub returned 401 for this repository. Check GITHUB_TOKEN is set and has read access to public repos."
        )
    if gh_err == "github_rate_limit":
        raise RuntimeError(
            "GitHub API rate limit exceeded. Wait a few minutes or use a personal access token with higher limits."
        )
    if gh_err == "github_forbidden":
        raise RuntimeError(
            "GitHub returned 403 (forbidden). The token may lack scope, or the API blocked the request."
        )
    if gh_err and str(gh_err).startswith("github_http_"):
        raise RuntimeError(
            f"GitHub API returned an unexpected error ({gh_err}). Try again or verify the repository URL."
        )
    if gh_err:
        raise RuntimeError(f"GitHub request failed: {gh_err}")

    scored = github_validation_scorer(repo_data, contributors, commits, readme_item, state)
    return scored


def _node_linkedin(state: dict[str, Any]) -> dict[str, Any]:
    if state.get("final_response"):
        return {}
    return linkedin_profile_builder(state)


def _node_trust(state: dict[str, Any]) -> dict[str, Any]:
    if state.get("final_response"):
        return {}
    return trust_score_engine(state)


def _route_github_done(state: dict[str, Any]) -> str:
    return "done" if state.get("final_response") else "continue"


def _route_after_trust(state: dict[str, Any]) -> str:
    if state.get("final_response"):
        return "done"
    return "gen" if state.get("proceed_to_generation") else "rej"


def _node_rejection_pack(state: dict[str, Any]) -> dict[str, Any]:
    return {"final_response": rejection_response(state)}


async def _node_tech(state: dict[str, Any]) -> dict[str, Any]:
    return extract_tech_and_context(state)


async def _node_mistral(state: dict[str, Any]) -> dict[str, Any]:
    return await call_mistral_and_merge(state)


def _node_image(state: dict[str, Any]) -> dict[str, Any]:
    return build_image_card(state)


def _node_success_final(state: dict[str, Any]) -> dict[str, Any]:
    return {"final_response": final_success_response(state)}


def build_analyze_graph():
    g = StateGraph(dict)
    g.add_node("parse", _node_parse)
    g.add_node("github", _node_github)
    g.add_node("linkedin", _node_linkedin)
    g.add_node("trust", _node_trust)
    g.add_node("reject", _node_rejection_pack)
    g.add_node("tech", _node_tech)
    g.add_node("mistral", _node_mistral)
    g.add_node("image", _node_image)
    g.add_node("finalize", _node_success_final)

    g.set_entry_point("parse")
    g.add_edge("parse", "github")
    g.add_conditional_edges(
        "github",
        _route_github_done,
        {"done": END, "continue": "linkedin"},
    )
    g.add_edge("linkedin", "trust")
    g.add_conditional_edges(
        "trust",
        _route_after_trust,
        {"done": END, "gen": "tech", "rej": "reject"},
    )
    g.add_edge("tech", "mistral")
    g.add_edge("mistral", "image")
    g.add_edge("image", "finalize")
    g.add_edge("reject", END)
    g.add_edge("finalize", END)
    return g.compile()


compiled_analyze_graph = build_analyze_graph()


async def run_analyze(body: dict[str, Any]) -> dict[str, Any]:
    result = await compiled_analyze_graph.ainvoke({"raw_body": body})
    fr = result.get("final_response")
    if isinstance(fr, dict):
        return fr
    raise RuntimeError("Analyze workflow did not produce a response.")
