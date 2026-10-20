"""Runtime configuration. Every value can be set with an environment variable (or a local .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # "gemini" in production. "offline-demo" produces rule-based placeholders (labelled not-AI) so the UI runs without a key.
    llm_provider: str = "gemini"
    gemini_api_key: str | None = Field(default=None, repr=False)
    gemini_model: str = "gemini-3.5-flash"
    llm_timeout_s: float = 90.0
    llm_max_retries: int = 2

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_backend: str = "fastembed"  # "fastembed" | "hashing"

    data_dir: Path = Path("data")

    # Resumes are short; anything bigger is almost certainly the wrong file.
    max_upload_mb: int = 5
    max_pages: int = 8
    max_job_chars: int = 20_000

    retrieval_k: int = 5
    llm_calls_per_hour: int = 60
    cors_origins: str = "http://localhost:3000"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "shortlist.db"

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"


@lru_cache
def get_settings() -> Settings:
    return Settings()
