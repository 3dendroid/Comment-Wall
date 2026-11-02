import os
import sys
import tempfile

import pytest

# app.py reads its settings at import time, so set them before importing it.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_tmp, 'test.db')}"
os.environ["ADMIN_TOKEN"] = "test-token"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # bad_words.txt

import app as app_module  # noqa: E402


@pytest.fixture
def client():
    with app_module.app.app_context():
        app_module.Comment.query.delete()
        app_module.db.session.commit()
    app_module.limiter.reset()
    return app_module.app.test_client()


@pytest.fixture
def post(client):
    """POST a comment from a fresh IP each time, so the 1-per-5-seconds limit
    doesn't get in the way of tests that post several comments."""
    counter = iter(range(1, 10_000))

    def _post(payload, **kwargs):
        if payload is not None:
            kwargs["json"] = payload
        headers = {"X-Forwarded-For": f"10.0.0.{next(counter)}"}
        return client.post("/comments", headers=headers, **kwargs)

    return _post
