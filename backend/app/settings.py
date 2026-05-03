import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    github_token: str = ""
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"
    # Comma-separated origins for browser calls (e.g. https://your-app.vercel.app).
    # Empty = allow any origin with credentials disabled (safe default).
    backend_cors_origins: str = ""


settings = Settings()


def log_config_status() -> None:
    """Log configuration gaps at startup (never log secret values)."""
    if not settings.github_token.strip():
        logger.warning("GITHUB_TOKEN is not set — /webhook/analyze will fail until it is configured.")
    if not settings.mistral_api_key.strip():
        logger.warning("MISTRAL_API_KEY is not set — generation will fail until it is configured.")
    if settings.github_token.strip() and settings.mistral_api_key.strip():
        logger.info("GitHub and Mistral API keys are present (values not logged).")
