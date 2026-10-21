import json

from evals.fixtures import job_text, render
from tests.conftest import add_job, auth, upload


def _setup(c):
    h = auth(c)
    data, name = render("priya")
    r = upload(c, h, data, name)
    j = add_job(c, h, job_text("backend"), "Senior Backend Engineer")
    return h, r, j


def test_job_aware_answers_cite_the_job_ad(client):
    h, r, j = _setup(client)
    res = client.post(f"/api/resumes/{r['id']}/ask", headers=h, json={"question": "Does the role offer ESOPs and a learning budget?", "job_id": j["id"]})
    assert res.status_code == 200, res.text
    cites = [c for claim in res.json()["result"]["answer"] for c in claim["citations"]]
    assert any(c["source"] == "job" and c["source_id"] == j["id"] for c in cites)
    assert any(x["section"] == "Job description" for x in res.json()["result"]["retrieval"])
    # Conversations are kept per job: the resume-only history doesn't include this one.
    assert len(client.get(f"/api/resumes/{r['id']}/questions?job_id={j['id']}", headers=h).json()["analyses"]) == 1
    assert client.get(f"/api/resumes/{r['id']}/questions", headers=h).json()["analyses"] == []


def test_asking_about_another_workspaces_job_is_refused(client):
    h, r, _ = _setup(client)
    _, _, other = _setup(client)
    res = client.post(f"/api/resumes/{r['id']}/ask", headers=h, json={"question": "What does it need?", "job_id": other["id"]})
    assert res.status_code == 404


def test_saved_items_dedupe_toggle_and_follow_their_resume(client):
    h, r, j = _setup(client)
    body = {"kind": "gap", "text": "Show Kubernetes in a bullet", "resume_id": r["id"], "job_id": j["id"], "href": f"/match/{r['id']}/{j['id']}"}
    first = client.post("/api/saved", headers=h, json=body).json()["item"]
    again = client.post("/api/saved", headers=h, json=body).json()["item"]
    assert first["id"] == again["id"]
    assert client.patch(f"/api/saved/{first['id']}", headers=h, json={"done": True}).json()["item"]["done"] is True
    assert client.post("/api/saved", headers=h, json=body | {"href": "https://evil.example"}).status_code == 422
    assert client.post("/api/saved", headers=h, json=body | {"kind": "nope"}).status_code == 422
    other = auth(client)
    assert client.get("/api/saved", headers=other).json()["items"] == []
    assert client.patch(f"/api/saved/{first['id']}", headers=other, json={"done": False}).status_code == 404
    client.delete(f"/api/resumes/{r['id']}", headers=h)
    assert client.get("/api/saved", headers=h).json()["items"] == []


def test_export_and_delete_the_whole_workspace(client, settings):
    h, r, j = _setup(client)
    client.post("/api/saved", headers=h, json={"kind": "suggestion", "text": "Add a number", "resume_id": r["id"]})
    exp = client.get("/api/workspace/export", headers=h).json()
    assert [x["id"] for x in exp["resumes"]] == [r["id"]] and exp["jobs"][0]["id"] == j["id"]
    assert exp["saved"][0]["text"] == "Add a number"
    assert '"embedding"' not in json.dumps(exp)  # vectors stay out of the export
    assert client.get("/api/workspace", headers=h).json()["resumes"] == 1
    assert any(settings.files_dir.iterdir())
    assert client.delete("/api/workspace", headers=h).status_code == 204
    assert not any(settings.files_dir.iterdir())  # the uploaded file is gone from disk too
    assert client.get("/api/overview", headers=h).status_code == 401  # the token no longer works


def test_cors_allows_every_method_the_api_uses(client):
    from app.config import get_settings

    origin = get_settings().cors_origins.split(",")[0].strip()
    for method in ("PUT", "PATCH", "DELETE"):
        r = client.options("/api/saved/x", headers={"Origin": origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "authorization,content-type"})
        assert r.status_code == 200 and method in r.headers["access-control-allow-methods"]
