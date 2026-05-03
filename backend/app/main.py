import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analyze_pipeline import run_analyze
from app.post_linkedin import post_to_linkedin
from app.settings import log_config_status, settings
from app.url_parse import parse_github_linkedin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _cors_origins() -> list[str]:
    raw = settings.backend_cors_origins.strip()
    if not raw:
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_config_status()
    yield


app = FastAPI(title="DevPost Pro API", version="2.0.0", lifespan=lifespan)

# Browsers only need CORS if they call this API directly. Next.js route handlers use
# server-side fetch and ignore CORS. allow_credentials=False avoids invalid *+credentials pairs.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness: always 200 for load balancers / quick probes."""
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> dict[str, Any]:
    """Readiness: confirms secrets required for analyze are present (does not call GitHub/Mistral)."""
    missing: list[str] = []
    if not settings.github_token.strip():
        missing.append("GITHUB_TOKEN")
    if not settings.mistral_api_key.strip():
        missing.append("MISTRAL_API_KEY")
    if missing:
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "missing_env": missing,
                "message": "Set the listed environment variables on the backend service.",
            },
        )
    return {"ok": True, "github": True, "mistral": True}


@app.post("/webhook/analyze")
async def webhook_analyze(body: dict[str, Any]) -> dict[str, Any]:
    try:
        return await run_analyze(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/analyze")
async def analyze_alias(body: dict[str, Any]) -> dict[str, Any]:
    return await webhook_analyze(body)


@app.post("/webhook/post-to-linkedin")
async def webhook_post(body: dict[str, Any]) -> dict[str, Any]:
    try:
        return await post_to_linkedin(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        msg = str(e)
        if "401" in msg or "403" in msg:
            raise HTTPException(status_code=401, detail="LinkedIn authorization failed.") from e
        raise HTTPException(status_code=502, detail=msg) from e


@app.post("/parse-debug")
async def parse_debug(body: dict[str, Any]) -> dict[str, Any]:
    """Validate URL parsing only (optional)."""
    try:
        return parse_github_linkedin(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
