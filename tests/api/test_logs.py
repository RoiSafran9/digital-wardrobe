"""Server operations log (activity logging spec §4.5): JSON lines with request context, a daily file."""
import io
import json
import logging
import logging.handlers
import pytest
from api import logs


@pytest.fixture
def capture():
    """A JSON handler on a string buffer, attached to the root logger for one test."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logs.JsonFormatter())
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    yield lambda: [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
    root.removeHandler(handler)
    root.setLevel(old_level)


def test_log_line_is_json_with_context(capture):
    tokens = [logs.request_id.set("r" * 32), logs.user_id.set("user-1")]
    try:
        logging.getLogger("wardrobe.test").info("hello %s", "there")
    finally:
        logs.request_id.reset(tokens[0])
        logs.user_id.reset(tokens[1])
    [line] = capture()
    assert line["msg"] == "hello there"
    assert line["level"] == "INFO"
    assert line["logger"] == "wardrobe.test"
    assert line["request_id"] == "r" * 32 and line["user_id"] == "user-1"
    assert "job_id" not in line
    assert line["ts"].endswith("Z")


def test_exception_carries_the_traceback(capture):
    try:
        raise ValueError("boom")
    except ValueError:
        logging.getLogger("wardrobe.test").exception("failed")
    [line] = capture()
    assert "ValueError" in line["exc"]


def test_extra_fields_are_kept(capture):
    logging.getLogger("wardrobe.test").info("request", extra={"fields": {"route": "/v1/items", "status": 200}})
    [line] = capture()
    assert line["route"] == "/v1/items" and line["status"] == 200


def test_configure_keeps_info_lines_and_a_daily_file(tmp_path):
    root = logging.getLogger()
    before = list(root.handlers)
    try:
        logs.configure_logging(str(tmp_path))
        logs.configure_logging(str(tmp_path))  # a second call adds nothing
        ours = [h for h in root.handlers if getattr(h, "_wardrobe", False)]
        assert len(ours) == 2
        files = [h for h in ours if isinstance(h, logging.handlers.TimedRotatingFileHandler)]
        assert len(files) == 1 and files[0].when == "MIDNIGHT" and files[0].backupCount == 14
        logging.getLogger("wardrobe.worker").info("storage sweep removed 3 files")
        files[0].flush()
        text = (tmp_path / "server.jsonl").read_text()
        assert json.loads(text.splitlines()[-1])["msg"] == "storage sweep removed 3 files"
    finally:
        for h in list(root.handlers):
            if h not in before:
                root.removeHandler(h)
                h.close()


def test_configure_without_a_directory_logs_only_to_stderr():
    root = logging.getLogger()
    before = list(root.handlers)
    try:
        logs.configure_logging(None)
        ours = [h for h in root.handlers if getattr(h, "_wardrobe", False)]
        assert len(ours) == 1 and not isinstance(ours[0], logging.FileHandler)
    finally:
        for h in list(root.handlers):
            if h not in before:
                root.removeHandler(h)


# --- request log -----------------------------------------------------------------------------------------

from tests.api.v1_helpers import A, as_user, v1_client  # noqa: E402
from api.store import MemoryStore  # noqa: E402

ITEM = "11111111-2222-4333-8444-555555555555"


def _requests(lines):
    return [line for line in lines if line["msg"] == "request"]


def test_request_log_uses_the_route_template(capture):
    client = v1_client(MemoryStore())
    assert client.get(f"/v1/items/{ITEM}?x=secret", headers=as_user(A)).status_code == 404
    [line] = _requests(capture())
    assert line["route"] == "/v1/items/{item_id}" and line["method"] == "GET" and line["status"] == 404
    assert line["user_id"] == A and isinstance(line["ms"], int)
    assert ITEM not in json.dumps(line) and "secret" not in json.dumps(line)


def test_request_id_is_returned_and_logged(capture):
    client = v1_client(MemoryStore())
    response = client.get("/v1/items", headers=as_user(A))
    rid = response.headers["X-Request-ID"]
    assert len(rid) == 32
    [line] = _requests(capture())
    assert line["request_id"] == rid
    given = "ab" * 16
    assert client.get("/v1/items", headers={**as_user(A), "X-Request-ID": given}).headers["X-Request-ID"] == given
    assert client.get("/v1/items", headers={**as_user(A), "X-Request-ID": "not-hex"}).headers["X-Request-ID"] != "not-hex"


def test_unmatched_path_is_not_logged_verbatim(capture):
    client = v1_client(MemoryStore())
    assert client.get("/nope/secret").status_code == 404
    [line] = _requests(capture())
    assert line["route"] == "unmatched" and "secret" not in json.dumps(line)
    assert "user_id" not in line


def test_a_failing_after_request_hook_is_only_logged(capture):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    app = FastAPI()
    app.get("/ok")(lambda: {"ok": True})

    def hook(request, status):
        raise RuntimeError("hook broke")
    logs.add_request_log(app, hook)
    assert TestClient(app).get("/ok").json() == {"ok": True}
    assert any(line["level"] == "WARNING" for line in capture())


def test_after_request_hook_sees_the_status_and_user():
    seen = []
    client = v1_client(MemoryStore(), on_response=lambda request, status: seen.append(
        (status, getattr(request.state, "user_id", None), request.scope["route"].path)))
    client.get("/v1/items", headers=as_user(A))
    assert seen == [(200, A, "/v1/items")]
