import re

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.config import Settings
from app.db import Database
from app.deps import get_db, get_embedder, get_llm, get_settings_dep
from app.llm.client import FakeLLM, NotConfiguredLLM
from app.llm.offline import OfflineDemoLLM
from app.llm.schemas import Assessment, Citation, MatchOut, RewriteOut, Variant
from app.main import create_app
from app.retrieval.embeddings import HashingEmbedder

_offline = OfflineDemoLLM()


def responder(schema: type[BaseModel], prompt: str) -> BaseModel:
    """Test model: the offline demo rules for most schemas, with hooks to simulate specific model behaviour."""
    if schema is MatchOut and "FABRICATE" in prompt:
        reqs = re.findall(r"^\[(R\d+)\]", prompt, re.M)
        return MatchOut(
            assessments=[
                Assessment(
                    requirement=r,
                    status="met",
                    explanation="Claimed.",
                    evidence=[Citation(passage="P1", quote="won the Turing Award in 2019 for distributed systems")],
                )
                for r in reqs
            ],
            summary=[],
        )
    if schema is RewriteOut and "INFLATE" in prompt:
        return RewriteOut(
            variants=[
                Variant(text="Cut costs by 45% using Kubernetes", rationale="Adds a number and a tool."),
                Variant(text="Reduced costs by [X]%", rationale="Placeholder."),
                Variant(text="Reduced costs", rationale="Plain."),
            ],
            questions=[],
        )
    out, _ = _offline.generate(system="", prompt=prompt, schema=schema)
    return out


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path, embedding_backend="hashing", gemini_api_key=None, llm_calls_per_hour=1000, _env_file=None)


@pytest.fixture
def fake_llm() -> FakeLLM:
    return FakeLLM(responder)


@pytest.fixture
def make_client(settings):
    def build(llm=None) -> TestClient:
        db = Database(settings.db_path)
        emb = HashingEmbedder()
        app = create_app()
        app.dependency_overrides[get_settings_dep] = lambda: settings
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_embedder] = lambda: emb
        app.dependency_overrides[get_llm] = lambda: llm or NotConfiguredLLM()
        return TestClient(app)

    return build


@pytest.fixture
def client(make_client, fake_llm) -> TestClient:
    return make_client(fake_llm)


def auth(c: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {c.post('/api/workspaces').json()['token']}"}


def upload(c: TestClient, h: dict, data: bytes, name: str) -> dict:
    r = c.post("/api/resumes", headers=h, files={"file": (name, data, "application/octet-stream")})
    assert r.status_code in (200, 201), r.text
    return r.json()["resume"]


def add_job(c: TestClient, h: dict, text: str, title: str | None = None) -> dict:
    r = c.post("/api/jobs", headers=h, json={"text": text, "title": title})
    assert r.status_code == 201, r.text
    return r.json()["job"]
