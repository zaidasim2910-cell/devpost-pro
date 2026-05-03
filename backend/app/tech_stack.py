import re
from typing import Any


def clean_sentence(text: str, max_length: int = 220) -> str:
    s = re.sub(r"\s+", " ", str(text or "")).strip()[:max_length]
    return re.sub(r"[,:;.\- ]+$", "", s)


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


TECH_PATTERNS = {
    "languages": [
        "Python",
        "JavaScript",
        "TypeScript",
        "Java",
        "Go",
        "Rust",
        "C++",
        "C#",
        "PHP",
        "Ruby",
        "Swift",
        "Kotlin",
        "R",
        "Scala",
    ],
    "frontend": [
        "React",
        "Next.js",
        "Vue",
        "Angular",
        "Svelte",
        "Tailwind",
        "HTML",
        "CSS",
        "Bootstrap",
    ],
    "backend": [
        "Node.js",
        "Express",
        "FastAPI",
        "Django",
        "Flask",
        "Spring",
        "NestJS",
        "Laravel",
    ],
    "databases": [
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Redis",
        "SQLite",
        "Supabase",
        "Firebase",
        "Pinecone",
        "Chroma",
    ],
    "cloud": [
        "AWS",
        "Azure",
        "GCP",
        "Vercel",
        "Netlify",
        "Docker",
        "Kubernetes",
        "Streamlit",
    ],
    "ai_ml": [
        "OpenAI",
        "LangChain",
        "RAG",
        "LLM",
        "Gemini",
        "GPT",
        "PyTorch",
        "TensorFlow",
        "scikit-learn",
        "pandas",
        "numpy",
    ],
    "tools": ["GitHub Actions", "REST API", "GraphQL", "OAuth", "JWT", "n8n"],
}


def extract_tech_and_context(data: dict[str, Any]) -> dict[str, Any]:
    readme = str(data.get("readme_content") or "")
    repo_meta = data.get("repo_meta") or {}

    combined_text = "\n".join(
        [
            readme,
            str(repo_meta.get("description") or ""),
            str(repo_meta.get("language") or ""),
            " ".join(repo_meta.get("topics") or []) if isinstance(repo_meta.get("topics"), list) else "",
        ]
    ).lower()

    detected: dict[str, list[str]] = {}
    for category, techs in TECH_PATTERNS.items():
        found = [t for t in techs if t.lower() in combined_text]
        if found:
            detected[category] = found

    primary_lang = str(repo_meta.get("language") or "")
    if primary_lang:
        flat_lower = {t.lower() for lst in detected.values() for t in lst}
        if primary_lang.lower() not in flat_lower:
            detected.setdefault("languages", []).append(primary_lang)

    tech_stack_flat = dedupe([t for lst in detected.values() for t in lst])

    raw_lines = [ln.strip() for ln in readme.split("\n") if ln.strip()]
    prose_lines = [
        ln
        for ln in raw_lines
        if not ln.startswith("#")
        and not re.match(r"^[-*+]\s", ln)
        and not re.match(r"^\d+\.\s", ln)
        and len(ln) > 30
    ]

    bullet_lines = []
    for ln in raw_lines:
        if re.match(r"^[-*+]\s", ln):
            cleaned = clean_sentence(re.sub(r"^[-*+]\s*", "", ln), 100)
            if len(cleaned) > 12:
                bullet_lines.append(cleaned)

    summary_seed = " ".join(prose_lines[:3]) or str(repo_meta.get("description") or "") or str(
        repo_meta.get("name") or "GitHub project"
    )

    goal_line = next(
        (
            ln
            for ln in prose_lines
            if re.search(
                r"(helps|solve|automate|designed to|built to|allows|enables|streamline|platform|tool|dashboard)",
                ln,
                re.I,
            )
        ),
        summary_seed,
    )

    audience_source = " ".join([str(repo_meta.get("description") or ""), *prose_lines])
    audience_match = re.search(r"\bfor\s+([A-Za-z0-9,&/()\- ]{4,80})", audience_source, re.I)
    target_users = clean_sentence(audience_match.group(1), 70) if audience_match else "IT and CS professionals"

    feature_candidates = dedupe(
        bullet_lines
        + [
            clean_sentence(ln, 100)
            for ln in prose_lines
            if re.search(
                r"(feature|supports|includes|pipeline|workflow|dashboard|automation|analysis|generation|upload|deployment|api)",
                ln,
                re.I,
            )
        ]
    )
    key_features = feature_candidates[:3]

    proof_points = dedupe(
        [
            f"Built with {primary_lang}" if primary_lang and primary_lang != "Not specified" else "",
            f"Uses {', '.join(tech_stack_flat[:3])}" if tech_stack_flat else "",
            f"{int(repo_meta.get('commit_count') or 0)} commits on GitHub"
            if int(repo_meta.get("commit_count") or 0) > 0
            else "",
            f"{int(repo_meta.get('contributor_count') or 0)} contributor"
            + (
                ""
                if int(repo_meta.get("contributor_count") or 0) == 1
                else "s"
            )
            if int(repo_meta.get("contributor_count") or 0) > 0
            else "",
            "Demo or deployment link available" if data.get("has_demo_link") else "",
            f"Homepage: {repo_meta.get('homepage')}" if repo_meta.get("homepage") else "",
        ]
    )[:4]

    project_context = {
        "headline": clean_sentence(str(repo_meta.get("name") or summary_seed), 80),
        "target_users": target_users,
        "value_prop": clean_sentence(goal_line or summary_seed, 180),
        "key_features": key_features,
        "proof_points": proof_points,
        "demo_url": str(repo_meta.get("homepage") or ""),
        "README_excerpt": clean_sentence(summary_seed, 260),
    }

    return {
        **data,
        "tech_stack": detected,
        "tech_stack_flat": tech_stack_flat,
        "project_summary": clean_sentence(summary_seed, 260),
        "readme_cleaned": readme[:5000],
        "project_context": project_context,
    }
