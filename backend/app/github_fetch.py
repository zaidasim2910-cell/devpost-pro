import base64
import re
from typing import Any

import httpx


GH_HEADERS_BASE = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "DevPostPro/2.0",
}


def strip_markdown(markdown: str) -> str:
    text = str(markdown or "")
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 \2", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"[>*_~]", " ", text)
    text = text.replace("\r", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def decode_readme(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    raw = item.get("content") or item.get("body") or item.get("data") or ""
    if not isinstance(raw, str) or not raw:
        return ""
    enc = str(item.get("encoding") or "").lower()
    if enc == "base64":
        try:
            return base64.b64decode(raw.replace("\n", "")).decode("utf8", errors="replace")
        except Exception:
            return raw
    return raw


async def fetch_github_bundle(
    owner: str,
    repo: str,
    token: str,
) -> tuple[
    dict[str, Any],
    list[dict[str, Any]],
    list[dict[str, Any]],
    dict[str, Any] | None,
    str | None,
]:
    headers = {**GH_HEADERS_BASE, "Authorization": f"token {token}"}
    base = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r_repo = await client.get(base, headers=headers)
        if r_repo.status_code == 404:
            return {}, [], [], None, "private_or_missing"
        if r_repo.status_code == 401:
            return {}, [], [], None, "github_auth_invalid"
        if r_repo.status_code == 403:
            try:
                rem = int(r_repo.headers.get("X-RateLimit-Remaining", "1"))
            except ValueError:
                rem = 1
            if rem == 0:
                return {}, [], [], None, "github_rate_limit"
            return {}, [], [], None, "github_forbidden"
        if r_repo.status_code != 200:
            return {}, [], [], None, f"github_http_{r_repo.status_code}"
        repo_data = r_repo.json()

        r_contrib = await client.get(f"{base}/contributors", headers=headers)
        contributors: list[dict[str, Any]] = []
        if r_contrib.status_code == 200:
            contributors = r_contrib.json()

        r_commits = await client.get(f"{base}/commits?per_page=30", headers=headers)
        commits: list[dict[str, Any]] = []
        if r_commits.status_code == 200:
            commits = r_commits.json()

        r_readme = await client.get(f"{base}/readme", headers=headers)
        readme_item: dict[str, Any] | None = None
        if r_readme.status_code == 200:
            readme_item = r_readme.json()

        return repo_data, contributors, commits, readme_item, None


def github_validation_scorer(
    repo_data: dict[str, Any],
    contributors_data: list[dict[str, Any]],
    commits_data: list[dict[str, Any]],
    readme_item: dict[str, Any] | None,
    input_data: dict[str, Any],
) -> dict[str, Any]:
    input_data = {k: v for k, v in input_data.items() if k != "raw_body"}
    readme_raw = decode_readme(readme_item)
    readme_plain = strip_markdown(readme_raw)
    readme_length = len(readme_plain)
    has_demo = bool(
        re.search(
            r"(demo|walkthrough|preview|video|streamlit|vercel|netlify|deploy|live)",
            readme_plain,
            re.I,
        )
    ) or bool(repo_data.get("homepage"))

    github_score = 0
    flags: list[str] = []
    warnings: list[str] = []

    if repo_data.get("fork") is True:
        flags.append("FORKED_REPO")
    else:
        github_score += 26

    contributor_count = len(contributors_data)
    owner_lower = str(input_data.get("github_owner", "")).lower()
    owner_contributor = next(
        (c for c in contributors_data if str(c.get("login", "")).lower() == owner_lower),
        None,
    )

    if contributor_count <= 1:
        github_score += 18
    elif contributor_count <= 3 and owner_contributor:
        github_score += 12
        warnings.append("MULTI_CONTRIBUTOR")
    else:
        github_score += 6
        warnings.append("TEAM_PROJECT")

    commit_count = len(commits_data)
    if commit_count >= 15:
        github_score += 18
    elif commit_count >= 5:
        github_score += 12
    elif commit_count >= 1:
        github_score += 8
    else:
        flags.append("INSUFFICIENT_COMMITS")

    if readme_length >= 1200:
        github_score += 22
    elif readme_length >= 400:
        github_score += 18
    elif readme_length >= 150:
        github_score += 12
        warnings.append("README_COULD_BE_BETTER")
    elif readme_length > 0:
        github_score += 6
        warnings.append("MINIMAL_README")
    else:
        flags.append("NO_README")

    repo_size = float(repo_data.get("size") or 0)
    if repo_size > 10:
        github_score += 10
    elif repo_size > 1:
        github_score += 6
        warnings.append("SMALL_REPO")
    else:
        flags.append("EMPTY_REPO")

    stars = int(repo_data.get("stargazers_count") or 0)
    if stars > 0:
        github_score += min(stars, 4)

    if has_demo:
        github_score += 4

    topics = repo_data.get("topics") or []
    if isinstance(topics, list) and len(topics) > 0:
        github_score += 2

    return {
        **input_data,
        "github_score": min(github_score, 100),
        "github_flags": flags,
        "github_warnings": warnings,
        "repo_meta": {
            "name": repo_data.get("name") or input_data.get("github_repo"),
            "full_name": repo_data.get("full_name")
            or f"{input_data.get('github_owner')}/{input_data.get('github_repo')}",
            "description": repo_data.get("description") or "",
            "language": repo_data.get("language") or "Not specified",
            "stars": repo_data.get("stargazers_count") or 0,
            "created_at": repo_data.get("created_at") or "",
            "updated_at": repo_data.get("updated_at") or "",
            "homepage": repo_data.get("homepage") or "",
            "topics": topics if isinstance(topics, list) else [],
            "is_fork": bool(repo_data.get("fork")),
            "contributor_count": contributor_count,
            "commit_count": commit_count,
            "default_branch": repo_data.get("default_branch") or "main",
            "size": repo_size,
        },
        "readme_content": readme_plain,
        "readme_raw": readme_raw,
        "has_demo_link": has_demo,
    }
