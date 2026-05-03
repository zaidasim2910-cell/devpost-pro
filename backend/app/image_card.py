import html
from typing import Any


def build_image_card(data: dict[str, Any]) -> dict[str, Any]:
    gp = data.get("generated_posts") or {}
    creative = gp.get("creative_brief") or {}
    rm = data.get("repo_meta") or {}
    highlights = [
        creative.get("highlight_1"),
        creative.get("highlight_2"),
        creative.get("highlight_3"),
    ]
    highlights = [h for h in highlights if h][:3]

    title_fallback = str(rm.get("name") or "")
    image_card_data = {
        "title": creative.get("headline") or title_fallback,
        "description": creative.get("subheadline") or data.get("project_summary") or "",
        "tech_stack": (data.get("tech_stack_flat") or [])[:6],
        "author_name": (data.get("linkedin_profile") or {}).get("name") or "",
        "author_role": (data.get("linkedin_profile") or {}).get("headline") or "",
        "language": rm.get("language") or "",
        "stars": rm.get("stars") or 0,
        "trust_badge": data.get("trust_badge") or "",
        "trust_score": data.get("trust_score") or 0,
        "github_url": data.get("github_url") or "",
        "proof_line": creative.get("proof_line") or "",
        "audience": creative.get("audience") or "",
        "highlights": highlights,
    }

    badge = str(data.get("trust_badge") or "")
    if badge == "VERIFIED":
        badge_color = "#059669"
        badge_text = "Verified Work"
    elif badge == "STANDARD":
        badge_color = "#d97706"
        badge_text = "Authenticated"
    else:
        badge_color = "#ea580c"
        badge_text = "Profile-backed"

    tech_badges = "".join(
        f'<span style="background:#dbeafe;color:#1d4ed8;padding:8px 14px;border-radius:999px;'
        f'font-size:15px;font-weight:600">{html.escape(str(t))}</span>'
        for t in image_card_data["tech_stack"]
    )

    highlight_blocks = "".join(
        f'<div style="flex:1;min-width:0;background:rgba(255,255,255,0.06);border:1px solid '
        f'rgba(148,163,184,0.24);border-radius:18px;padding:18px">'
        f'<div style="color:#e2e8f0;font-size:18px;font-weight:600;line-height:1.35">'
        f"{html.escape(str(item))}</div></div>"
        for item in highlights
    )

    eyebrow = creative.get("eyebrow") or "Project spotlight"
    audience_html = ""
    if image_card_data["audience"]:
        audience_html = (
            f'<div style="color:#93c5fd;font-size:18px;font-weight:600">Built for '
            f'{html.escape(str(image_card_data["audience"])[:80])}</div>'
        )

    desc = html.escape(str(image_card_data["description"])[:180])
    title_h = html.escape(str(image_card_data["title"])[:120])
    proof = html.escape(str(image_card_data["proof_line"])[:90])

    image_html = f"""<div style="width:1200px;height:630px;background:linear-gradient(135deg,#0f172a 0%,#172554 45%,#1e293b 100%);padding:52px;display:flex;flex-direction:column;justify-content:space-between;font-family:Inter,Segoe UI,Arial,sans-serif;box-sizing:border-box">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px">
    <div>
      <div style="color:#93c5fd;font-size:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">DevPost Pro</div>
      <div style="color:#94a3b8;font-size:18px;margin-top:12px">{html.escape(str(eyebrow))}</div>
    </div>
    <div style="background:{badge_color};color:white;padding:10px 18px;border-radius:999px;font-size:15px;font-weight:700">{html.escape(badge_text)}</div>
  </div>

  <div style="display:flex;flex-direction:column;gap:18px">
    <h1 style="margin:0;color:white;font-size:54px;line-height:1.05;font-weight:800;max-width:920px">{title_h}</h1>
    <p style="margin:0;color:#cbd5e1;font-size:24px;line-height:1.4;max-width:940px">{desc}</p>
    {audience_html}
  </div>

  <div style="display:flex;flex-direction:column;gap:18px">
    {"<div style=\"display:flex;gap:16px\">" + highlight_blocks + "</div>" if highlight_blocks else ""}
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
      <div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">{tech_badges}</div>
        <div style="color:#e2e8f0;font-size:20px;font-weight:600">{html.escape(str(image_card_data["author_name"]))}</div>
        <div style="color:#94a3b8;font-size:18px;margin-top:6px">{html.escape(str(image_card_data["author_role"]))}</div>
      </div>
      <div style="text-align:right;max-width:360px">
        <div style="color:#cbd5e1;font-size:18px;font-weight:600">{proof}</div>
        <div style="color:#64748b;font-size:16px;margin-top:8px">{html.escape(str(rm.get("name") or ""))}</div>
      </div>
    </div>
  </div>
</div>"""

    return {
        **data,
        "image_card": {"html": image_html, "data": image_card_data},
    }
