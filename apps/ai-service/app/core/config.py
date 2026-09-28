"""Application settings - env-driven, no secrets hard-coded."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        extra="ignore",
    )

    app_name: str = "ai-service"
    port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Provider selection is intentionally generic; no vendor is hard-coded.
    ai_provider: str = ""
    ai_api_key: str = ""
    ai_model: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
