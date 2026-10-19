"""'Notify when ready': tell a job's owner on their phone that the work is done, through Expo's push
service. Best effort only: a push that can't be sent never fails or delays the job's result."""
import logging
import re
import threading
import httpx

log = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BACKGROUND = True  # send on a side thread so the worker (and the API it shares a loop with) never waits
TOKEN_RE = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{1,200}\]$")


def valid_token(token: str) -> bool:
    return bool(TOKEN_RE.match(token or ""))


def send(batch: list[dict]) -> None:
    """Hand the messages to Expo (one request, up to 100 messages). Replaced in tests."""
    httpx.post(EXPO_PUSH_URL, json=batch, timeout=10).raise_for_status()


def _message(job: dict, status: str, result: dict | None, error: str | None) -> tuple[str, str] | None:
    kind = job["kind"]
    if status != "succeeded":
        if kind in ("garment", "back", "turn", "outfit_generate"):
            return "Generation paused", error or "Something went wrong — open the app to try again."
        return None
    if kind == "garment":
        made = len((result or {}).get("item_ids", []))
        if not made:
            return "Your photo is done", "Open the app to see what was found."
        return "Your pieces are ready", f"{made} new {'piece is' if made == 1 else 'pieces are'} in your closet."
    if kind == "back":
        return "Back image ready", "The back of your piece is in your closet."
    if kind == "turn":
        return "360° view ready", "Open the piece to turn it around."
    if kind == "outfit_generate":
        made = len((result or {}).get("item_ids", []))
        return "Your outfit pieces are ready", f"{made} {'piece is' if made == 1 else 'pieces are'} waiting for your review."
    return None


def notify_job(store, job: dict, status: str, result: dict | None = None, error: str | None = None) -> None:
    try:
        text = _message(job, status, result, error)
        if text is None:
            return
        tokens = store.push_tokens(job["user_id"])
        if not tokens:
            return
        title, body = text
        batch = [{"to": t, "title": title, "body": body, "sound": "default", "data": {"job_id": job["id"], "kind": job["kind"]}}
                 for t in tokens[:100]]
    except Exception:
        log.warning("push for job %s not prepared", job.get("id"), exc_info=True)
        return

    def deliver():
        try:
            send(batch)
        except Exception:
            log.warning("push for job %s not sent", job.get("id"), exc_info=True)

    if BACKGROUND:
        threading.Thread(target=deliver, daemon=True).start()
    else:
        deliver()
