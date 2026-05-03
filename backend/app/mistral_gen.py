import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.settings import settings


def build_mistral_prompt(data: dict[str, Any]) -> str:
    lp = data.get("linkedin_profile") or {}
    rm = data.get("repo_meta") or {}
    return f"""You are an expert LinkedIn content strategist for IT professionals. Generate 3 LinkedIn posts for this developer's GitHub project. Return ONLY raw JSON — no markdown, no backticks, no explanation.

PROFESSIONAL CONTEXT:
- Name: {lp.get('name') or 'Professional'}
- Role: {lp.get('headline') or 'IT Professional'}
- Location: {lp.get('location') or ''}
- Tone: {data.get('tone') or 'professional'}

PROJECT DATA:
- Repo: {rm.get('name') or ''}
- Description: {rm.get('description') or ''}
- Language: {rm.get('language') or ''}
- Stars: {rm.get('stars') or 0}
- Tech stack: {', '.join(data.get('tech_stack_flat') or [])}
- Summary: {data.get('project_summary') or ''}
- README excerpt: {str(data.get('readme_cleaned') or '')[:1500]}

Return exactly this JSON structure with no extra text:
{{
  "post_technical": {{
    "content": "150-200 word technical deep-dive post. Bold hook. Explain problem solved and tech decisions. End with a question.",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "post_type": "Technical Deep-Dive",
    "best_time_to_post": "Tuesday-Thursday 8-10am",
    "expected_reach": "High engagement from developers"
  }},
  "post_story": {{
    "content": "150-200 word lessons-learned narrative. Personal challenge. The journey. Key takeaway.",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "post_type": "Lessons Learned",
    "best_time_to_post": "Monday 9am or Friday 12pm",
    "expected_reach": "High engagement from career-focused audience"
  }},
  "post_announcement": {{
    "content": "100-150 word project announcement. Lead with impact. Accessible to non-technical readers. CTA to check repo.",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "post_type": "Project Announcement",
    "best_time_to_post": "Wednesday 10am-12pm",
    "expected_reach": "Broadest reach"
  }},
  "recruiter_score": {{
    "technical_post": 8,
    "story_post": 7,
    "announcement_post": 9,
    "reasoning": "Brief explanation of scores"
  }},
  "creative_brief": {{
    "headline": "Short punchy project headline",
    "subheadline": "One line value prop",
    "eyebrow": "Project spotlight",
    "highlight_1": "Highlight one",
    "highlight_2": "Highlight two",
    "highlight_3": "Highlight three",
    "proof_line": "Proof metric or credibility line",
    "audience": "Who this is for"
  }}
}}"""


async def call_mistral_and_merge(data: dict[str, Any]) -> dict[str, Any]:
    if not settings.mistral_api_key:
        raise RuntimeError("MISTRAL_API_KEY is not configured on the backend.")

    prompt = build_mistral_prompt(data)
    body = {
        "model": settings.mistral_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 2000,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "content-type": "application/json",
                "Authorization": f"Bearer {settings.mistral_api_key}",
                "Accept": "application/json",
            },
            json=body,
        )
        r.raise_for_status()
        mistral_response = r.json()

    response_text = mistral_response["choices"][0]["message"]["content"]
    posts = _parse_posts_json(response_text)

    return {
        **data,
        "generated_posts": posts,
        "generation_timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _parse_posts_json(response_text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```json|```", "", response_text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", response_text)
        if m:
            return json.loads(m.group(0))
        raise RuntimeError(f"Mistral did not return valid JSON. Snippet: {response_text[:300]}")
