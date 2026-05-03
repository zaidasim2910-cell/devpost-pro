import base64
import re
from typing import Any

import httpx


def combine_post_text(body: dict[str, Any]) -> dict[str, Any]:
    hashtags = body.get("hashtags") or []
    if not isinstance(hashtags, list):
        hashtags = []
    hashtag_line = " ".join(str(h) for h in hashtags)
    repo_line = f"\n\n{body['repo_url']}" if body.get("repo_url") else ""
    full_post_content = f"{body.get('post_content') or ''}\n\n{hashtag_line}{repo_line}".strip()
    return {**body, "full_post_content": full_post_content}


def slug_repo_name(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(name or "devpost-pro").lower()).strip("-")
    return s or "devpost-pro"


def strip_image_data_url(image_base64: str) -> str:
    s = str(image_base64 or "")
    if "base64," in s:
        return s.split("base64,", 1)[1]
    return s


async def post_to_linkedin(body: dict[str, Any]) -> dict[str, Any]:
    """
    LinkedIn asset register → PNG upload → UGC post (legacy workflow parity).
    Expects: post_content, hashtags, image_base64, repo_name,
             access_token, linkedin_user_id
    """
    data = combine_post_text(body)
    raw_b64 = strip_image_data_url(str(data.get("image_base64") or ""))
    if not raw_b64.strip():
        raise ValueError("image_base64 is required for direct LinkedIn posting.")

    image_bytes = base64.b64decode(raw_b64)
    access_token = str(data.get("access_token") or "")
    linkedin_user_id = str(data.get("linkedin_user_id") or "")
    repo_name = str(data.get("repo_name") or "devpost-pro")
    full_post_content = str(data.get("full_post_content") or "")
    file_name = f"{slug_repo_name(repo_name)}.png"

    headers_auth = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    register_body = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": linkedin_user_id,
            "serviceRelationships": [
                {"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}
            ],
            "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"],
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        reg = await client.post(
            "https://api.linkedin.com/v2/assets?action=registerUpload",
            headers=headers_auth,
            json=register_body,
        )
        reg.raise_for_status()
        reg_json = reg.json()

        upload_url = (
            reg_json.get("value", {})
            .get("uploadMechanism", {})
            .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
            .get("uploadUrl")
        )
        asset_urn = reg_json.get("value", {}).get("asset")
        if not upload_url:
            raise RuntimeError(
                "LinkedIn did not return an upload URL. Check your access token and LinkedIn user ID."
            )

        put = await client.put(
            upload_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "image/png",
            },
            content=image_bytes,
        )
        put.raise_for_status()

        title_text = repo_name[:200]
        ugc_body = {
            "author": linkedin_user_id,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": full_post_content},
                    "shareMediaCategory": "IMAGE",
                    "media": [
                        {
                            "status": "READY",
                            "description": {"text": "Project showcase by DevPost Pro"},
                            "media": asset_urn,
                            "title": {"text": title_text},
                        }
                    ],
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        post_res = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers=headers_auth,
            json=ugc_body,
        )
        post_res.raise_for_status()
        post_result = post_res.json()

    post_id = post_result.get("id") or ""
    post_url = (
        f"https://www.linkedin.com/feed/update/{post_id}"
        if post_id
        else "https://www.linkedin.com/feed/"
    )

    return {
        "status": "posted",
        "post_id": post_id,
        "post_url": post_url,
        "message": "Your post is now live on LinkedIn!",
    }
