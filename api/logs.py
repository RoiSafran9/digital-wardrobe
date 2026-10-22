"""Server operations log (account mode): JSON lines to stderr and to logs/server.jsonl, one file a day, 14 kept.

Each line carries the request id, user id and job id in effect (context variables), so one request or job
can be followed. Requests are logged by their route template (/v1/items/{item_id}), never the filled-in
path or query, and client addresses are not logged (uvicorn runs with --no-access-log).
"""
import json
import logging
import logging.handlers
import os
import time
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id: ContextVar[str | None] = ContextVar("user_id", default=None)
job_id: ContextVar[str | None] = ContextVar("job_id", default=None)

KEEP_DAYS = 14
log = logging.getLogger("wardrobe.request")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for name, var in (("request_id", request_id), ("user_id", user_id), ("job_id", job_id)):
            value = var.get()
            if value is not None:
                line[name] = value
        line.update(getattr(record, "fields", None) or {})
        if record.exc_info:
            line["exc"] = "".join(traceback.format_exception(*record.exc_info))
        return json.dumps(line, default=str)


def configure_logging(directory: str | None = "logs", level: int = logging.INFO) -> None:
    """JSON to stderr, plus a daily file in `directory` (None: stderr only). Calling it again changes nothing."""
    root = logging.getLogger()
    if any(getattr(h, "_wardrobe", False) for h in root.handlers):
        return
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    if directory:
        os.makedirs(directory, exist_ok=True)
        handlers.append(logging.handlers.TimedRotatingFileHandler(
            os.path.join(directory, "server.jsonl"), when="midnight", backupCount=KEEP_DAYS, utc=True))
    for handler in handlers:
        handler.setFormatter(JsonFormatter())
        handler._wardrobe = True
        root.addHandler(handler)
    root.setLevel(level)
    # httpx logs every Supabase call's full URL (with ids and filters); keep it to warnings.
    logging.getLogger("httpx").setLevel(logging.WARNING)


_REQUEST_ID_CHARS = set("0123456789abcdef")


def _incoming_id(value: str | None) -> str:
    if value and len(value) == 32 and set(value) <= _REQUEST_ID_CHARS:
        return value
    return uuid.uuid4().hex


def add_request_log(app, on_response=None) -> None:
    """Log each request (method, route template, status, ms) with a request id, also sent back as X-Request-ID.
    on_response(request, status) runs afterwards (activity events for refusals); its errors are only logged."""

    @app.middleware("http")
    async def _request_log(request, call_next):
        rid = _incoming_id(request.headers.get("X-Request-ID"))
        token = request_id.set(rid)
        start = time.monotonic()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            route = request.scope.get("route")
            uid = getattr(request.state, "user_id", None)
            user_token = user_id.set(uid) if uid else None
            log.info("request", extra={"fields": {
                "method": request.method,
                "route": getattr(route, "path", None) or "unmatched",
                "status": status,
                "ms": round((time.monotonic() - start) * 1000),
            }})
            if on_response:
                try:
                    on_response(request, status)
                except Exception:
                    log.warning("after-request hook failed", exc_info=True)
            if user_token:
                user_id.reset(user_token)
            request_id.reset(token)
