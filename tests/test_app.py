import app as app_module

AUTH = {"Authorization": "Bearer test-token"}


def test_post_and_get_comment(client, post):
    res = post({"text": "  hello  "})
    assert res.status_code == 201
    body = res.get_json()
    assert body["text"] == "hello"
    assert body["created_at"].endswith("Z")
    assert client.get("/comments").get_json() == [body]


def test_post_non_string_text_is_400(post):
    for bad in (123, None, ["x"], {"a": 1}):
        res = post({"text": bad})
        assert res.status_code == 400, bad


def test_post_non_json_body_is_400(post):
    assert post(None, data="text=hi").status_code == 400
    assert post(["not", "an", "object"]).status_code == 400


def test_post_too_long_is_400(post):
    assert post({"text": "a" * 500}).status_code == 201
    assert post({"text": "a" * 501}).status_code == 400


def test_bad_words_and_common_tricks_are_rejected(post):
    for text in ("fuck", "f u c k", "f.u.c.k", "fuuuuck", "F U C K this"):
        assert post({"text": text}).status_code == 400, text
    for text in ("a b c", "hello world", "I am ok", "aaa good"):
        assert post({"text": text}).status_code == 201, text


def test_get_comments_is_not_capped_at_100_per_hour(client):
    # the page polls every 5 s; the old 100/hour limit broke it after ~8 minutes
    for _ in range(60):
        assert client.get("/comments").status_code == 200


def test_post_rate_limit_is_per_client_ip(client):
    def post_from(ip):
        return client.post(
            "/comments", json={"text": "hi"}, headers={"X-Forwarded-For": ip}
        )

    assert post_from("1.1.1.1").status_code == 201
    assert post_from("1.1.1.1").status_code == 429
    # a different visitor behind the same proxy is not blocked
    assert post_from("2.2.2.2").status_code == 201


def test_pagination(client, post):
    ids = [post({"text": f"c{i}"}).get_json()["id"] for i in range(5)]
    assert len(client.get("/comments").get_json()) == 5
    page1 = client.get("/comments?limit=2").get_json()
    assert [c["id"] for c in page1] == ids[::-1][:2]
    page2 = client.get(f"/comments?limit=2&before={page1[-1]['id']}").get_json()
    assert [c["id"] for c in page2] == ids[::-1][2:4]
    assert client.get("/comments?limit=0").status_code == 400
    assert client.get("/comments?limit=101").status_code == 400


def test_delete_requires_token(client, post):
    cid = post({"text": "x"}).get_json()["id"]
    assert client.delete(f"/comments/{cid}").status_code == 401
    assert client.delete(
        f"/comments/{cid}", headers={"Authorization": "Bearer wrong"}
    ).status_code == 401
    assert client.delete(
        f"/comments/{cid}", headers={"Authorization": "Bearer None"}
    ).status_code == 401
    assert client.delete(f"/comments/{cid}", headers=AUTH).status_code == 200
    assert client.delete(f"/comments/{cid}", headers=AUTH).status_code == 404


def test_failed_admin_attempts_are_limited(client):
    for _ in range(10):
        assert client.post("/admin-verify", headers={"Authorization": "x"}).status_code == 401
    assert client.post("/admin-verify", headers=AUTH).status_code == 429


def test_successful_admin_requests_are_not_limited(client):
    for _ in range(20):
        assert client.post("/admin-verify", headers=AUTH).status_code == 200


def test_created_at_column_is_added_to_old_table(tmp_path, monkeypatch):
    """A database made by the previous version has no created_at column;
    starting the app must add it instead of failing on every query."""
    import importlib
    import sqlite3
    import sys

    db_file = tmp_path / "old.db"
    con = sqlite3.connect(db_file)
    con.execute("CREATE TABLE comment (id INTEGER PRIMARY KEY, text VARCHAR(500) NOT NULL)")
    con.execute("INSERT INTO comment (text) VALUES ('old one')")
    con.commit()
    con.close()

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.delitem(sys.modules, "app")
    fresh = importlib.import_module("app")
    try:
        res = fresh.app.test_client().get("/comments")
        assert res.get_json() == [{"id": 1, "text": "old one", "created_at": None}]
    finally:
        sys.modules["app"] = app_module


def test_security_headers_on_page_and_api(client):
    for path in ("/", "/comments"):
        res = client.get(path)
        csp = res.headers["Content-Security-Policy"]
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "'unsafe-inline'" not in csp
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["Referrer-Policy"] == "same-origin"


def test_page_has_no_inline_scripts_styles_or_handlers(client):
    import re

    html = client.get("/").get_data(as_text=True)
    assert not re.search(r"<script(?![^>]*\bsrc=)", html)  # every script has src=
    assert "<style" not in html
    assert not re.search(r"\son[a-z]+=", html)  # onclick=, onload=, ...
    assert ' style="' not in html
