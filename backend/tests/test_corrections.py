from evals.fixtures import render
from tests.conftest import auth, upload


def _priya(c, h):
    data, name = render("priya")
    return upload(c, h, data, name)


def test_correcting_a_section_type_reparses_and_keeps_bullet_ids(client):
    h = auth(client)
    r = _priya(client, h)
    before = client.get(f"/api/resumes/{r['id']}", headers=h).json()["resume"]
    sections = before["parsed"]["sections"]
    exp = next(i for i, s in enumerate(sections) if s["key"] == "experience")
    ids_before = {b["text"]: b["id"] for b in before["parsed"]["bullets"]}

    # Call the experience section "projects": its bullets move with it, and their ids survive.
    res = client.put(f"/api/resumes/{r['id']}/corrections", headers=h, json={"section_keys": {str(exp): "projects"}})
    assert res.status_code == 200
    after = res.json()["resume"]
    assert after["parsed"]["sections"][exp]["key"] == "projects"
    moved = [b for b in after["parsed"]["bullets"] if b["section"] == "projects"]
    assert moved and all(ids_before[b["text"]] == b["id"] for b in moved)
    assert after["parsed"]["corrections"]["sections"] == {str(exp): "projects"}

    # Corrections accumulate: a later edit keeps the earlier one.
    again = client.put(f"/api/resumes/{r['id']}/corrections", headers=h, json={"name": "Priya R."}).json()["resume"]
    assert again["parsed"]["sections"][exp]["key"] == "projects"
    assert again["name"] == "Priya R."


def test_contact_and_skills_overrides_rerun_checks(client):
    h = auth(client)
    r = _priya(client, h)
    res = client.put(
        f"/api/resumes/{r['id']}/corrections",
        headers=h,
        json={"contact": {"email": None, "phone": None, "nonsense": "x"}, "skills": ["Go", " go ", "Rust", ""]},
    ).json()["resume"]
    assert res["parsed"]["contact"]["email"] is None
    assert "nonsense" not in res["parsed"]["contact"]
    assert res["parsed"]["skills_listed"] == ["Go", "Rust"]
    contact = next(c for c in res["checks"] if c["id"] == "contact")
    assert contact["status"] != "pass"  # no email or phone any more


def test_corrections_are_validated_and_private(client):
    a, b = auth(client), auth(client)
    r = _priya(client, a)
    assert client.put(f"/api/resumes/{r['id']}/corrections", headers=a, json={"section_keys": {"99": "skills"}}).status_code == 422
    assert client.put(f"/api/resumes/{r['id']}/corrections", headers=a, json={"section_keys": {"1": "hobbies!"}}).status_code == 422
    assert client.put(f"/api/resumes/{r['id']}/corrections", headers=b, json={"name": "x"}).status_code == 404


def test_browsers_may_send_corrections_cross_origin(client):
    # The frontend runs on another origin, so the PUT is preflighted; every method the API uses must be allowed.
    from app.config import get_settings

    origin = get_settings().cors_origins.split(",")[0].strip()
    r = client.options(
        "/api/resumes/x/corrections",
        headers={"Origin": origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert r.status_code == 200
    assert "PUT" in r.headers["access-control-allow-methods"]
