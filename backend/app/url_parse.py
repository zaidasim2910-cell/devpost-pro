import re
from typing import Any


def parse_github_linkedin(body: dict[str, Any]) -> dict[str, Any]:
    github_url = str(body.get("github_url") or "").strip().rstrip("/")
    parts = github_url.replace("https://github.com/", "").split("/")
    github_owner = parts[0] if len(parts) > 0 else ""
    github_repo = parts[1] if len(parts) > 1 else ""

    linkedin_url = str(body.get("linkedin_url") or "").strip().rstrip("/")
    m = re.search(r"/in/([^/]+)", linkedin_url)
    linkedin_username = (m.group(1) if m else "").rstrip("/")

    if not github_owner or not github_repo:
        raise ValueError("Invalid GitHub URL format. Expected: https://github.com/username/repo")

    return {
        "github_owner": github_owner,
        "github_repo": github_repo,
        "github_url": github_url,
        "linkedin_url": linkedin_url,
        "linkedin_username": linkedin_username,
        "tone": str(body.get("tone") or "professional"),
        "linkedin_access_token": str(body.get("linkedin_access_token") or ""),
        "linkedin_user_id": str(body.get("linkedin_user_id") or ""),
        "linkedin_profile_name": str(body.get("linkedin_profile_name") or ""),
        "linkedin_profile_headline": str(body.get("linkedin_profile_headline") or ""),
        "linkedin_profile_location": str(body.get("linkedin_profile_location") or ""),
    }
