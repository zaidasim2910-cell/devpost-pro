from typing import Any


def linkedin_profile_builder(data: dict[str, Any]) -> dict[str, Any]:
    linkedin_url = str(data.get("linkedin_url") or "").strip()
    name = str(data.get("linkedin_profile_name") or "").strip() or "Professional"
    headline = str(data.get("linkedin_profile_headline") or "").strip() or "IT Professional"
    location = str(data.get("linkedin_profile_location") or "").strip()

    linkedin_score = 35
    linkedin_warnings: list[str] = []

    if linkedin_url:
        linkedin_score += 15
    else:
        linkedin_warnings.append("LINKEDIN_URL_MISSING")

    if name and name != "Professional":
        linkedin_score += 20
    else:
        linkedin_warnings.append("LINKEDIN_NAME_MISSING")

    if headline and headline != "IT Professional":
        linkedin_score += 20
    else:
        linkedin_warnings.append("LINKEDIN_HEADLINE_MISSING")

    if location:
        linkedin_score += 10

    return {
        **data,
        "linkedin_score": min(linkedin_score, 100),
        "linkedin_flags": [],
        "linkedin_warnings": linkedin_warnings,
        "linkedin_scrape_success": bool(linkedin_url),
        "linkedin_profile": {
            "name": name,
            "headline": headline,
            "location": location,
            "connection_count": 0,
            "profile_exists": bool(linkedin_url),
        },
    }


def trust_score_engine(data: dict[str, Any]) -> dict[str, Any]:
    github_weighted = (float(data.get("github_score") or 0) / 100) * 75
    linkedin_weighted = (float(data.get("linkedin_score") or 0) / 100) * 25
    total_score = round(github_weighted + linkedin_weighted)

    trust_level = ""
    trust_badge = ""
    proceed_to_generation = False
    rejection_reason = ""

    all_flags = list(data.get("github_flags") or []) + list(data.get("linkedin_flags") or [])
    warning_codes = list(data.get("github_warnings") or []) + list(data.get("linkedin_warnings") or [])

    if "FORKED_REPO" in all_flags:
        trust_level = "REJECTED"
        rejection_reason = (
            "This repository appears to be a fork. DevPost Pro only generates content for original work."
        )
    elif "EMPTY_REPO" in all_flags:
        trust_level = "REJECTED"
        rejection_reason = (
            "This repository appears to be empty or too small to analyze meaningfully. "
            "Add more project material and try again."
        )
    elif "INSUFFICIENT_COMMITS" in all_flags:
        trust_level = "REJECTED"
        rejection_reason = (
            "This repository does not have enough commit history yet. "
            "Add at least one meaningful commit before generating posts."
        )
    elif total_score >= 80:
        trust_level = "HIGH"
        trust_badge = "VERIFIED"
        proceed_to_generation = True
    elif total_score >= 60:
        trust_level = "MEDIUM"
        trust_badge = "STANDARD"
        proceed_to_generation = True
    elif total_score >= 45:
        trust_level = "LOW"
        trust_badge = "BASIC"
        proceed_to_generation = True
    else:
        trust_level = "REJECTED"
        rejection_reason = (
            f"This project scored {total_score}/100 on the credibility check. "
            "Strengthen the README, commit history, or project substance and try again."
        )

    warning_map = {
        "MULTI_CONTRIBUTOR": "Multiple contributors detected",
        "TEAM_PROJECT": "Team project detected",
        "README_COULD_BE_BETTER": "README could be more detailed",
        "MINIMAL_README": "README is minimal",
        "SMALL_REPO": "Repository is still small",
        "LINKEDIN_URL_MISSING": "LinkedIn URL is missing",
        "LINKEDIN_NAME_MISSING": "Profile name is missing",
        "LINKEDIN_HEADLINE_MISSING": "Profile headline is missing",
    }

    warning_messages = list({warning_map.get(c, c) for c in warning_codes})

    readme_pass = "NO_README" not in all_flags and "MINIMAL_README" not in warning_codes

    score_breakdown = {
        "total": total_score,
        "github_component": round(github_weighted),
        "linkedin_component": round(linkedin_weighted),
        "checks": {
            "is_original_work": "FORKED_REPO" not in all_flags,
            "solo_or_lead_author": "TEAM_PROJECT" not in warning_codes,
            "has_commit_history": "INSUFFICIENT_COMMITS" not in all_flags,
            "readme_quality": readme_pass,
            "linkedin_profile_real": bool(data.get("linkedin_url")),
        },
        "warnings": warning_messages,
    }

    return {
        **data,
        "trust_score": total_score,
        "trust_level": trust_level,
        "trust_badge": trust_badge,
        "proceed_to_generation": proceed_to_generation,
        "rejection_reason": rejection_reason,
        "score_breakdown": score_breakdown,
    }


def badge_for_ui(badge: str) -> str:
    """Map workflow badges to UI-supported values."""
    if badge == "VERIFIED":
        return "VERIFIED"
    return "STANDARD"


def trust_level_for_ui(level: str) -> str:
    if level in ("HIGH", "MEDIUM", "LOW"):
        return level
    return "LOW"
