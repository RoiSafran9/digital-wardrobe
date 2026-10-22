"""User-owned data for the multi-user API: Supabase (Postgres + private Storage) over its HTTP APIs.

The backend uses the secret key, which bypasses row level security, so every method that reads or
changes a user's data takes that user's id and filters by it. MemoryStore mirrors the same rules
for tests.
"""
import copy
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
import httpx
from api.auth import Settings
from api.controls import PAID_KINDS
from api.credits import ACTIONS, CreditError
from api.activity import ONCE

BUCKET = "wardrobe"
SIGNED_URL_SECONDS = 3600
ACTIVE = ("queued", "running")
INTERRUPTED = "Interrupted — try again"
BANNED_FOR = "876000h"  # ~100 years: Supabase Auth has no "forever"


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MemoryStore:
    def __init__(self, public_url: str = "https://storage.test"):
        self.public_url = public_url
        self.jobs: dict[str, dict] = {}
        self.items: dict[str, dict] = {}
        self.files: dict[str, bytes] = {}
        self.file_times: dict[str, datetime] = {}
        self.disabled: set[str] = set()
        self.deleted_users: set[str] = set()
        self.emails: dict[str, str] = {}  # email -> user id, for the admin grant tool
        self.wallets: dict[str, dict] = {}
        self.ledger: list[dict] = []
        self.names: dict[str, str] = {}  # user id -> display name
        self.tokens: dict[str, list[str]] = {}  # user id -> Expo push tokens
        self.passwords: dict[str, str] = {}  # user id -> password (the App Review demo account only)
        self.banned: set[str] = set()
        self.events: list[dict] = []  # activity events (api/activity.py)
        self.ai_calls: list[dict] = []  # model calls, kept without the account when it is deleted (D1)
        self.signups: dict[str, datetime] = {}  # user id -> profile created_at, for the activation report

    # Profiles
    def profile_status(self, user_id: str) -> str:
        return "disabled" if user_id in self.disabled else "active"

    def user_exists(self, user_id: str) -> bool:
        return user_id not in self.deleted_users

    def display_name(self, user_id):
        return self.names.get(user_id)

    def add_push_token(self, user_id, token):
        mine = self.tokens.setdefault(user_id, [])
        if token not in mine:
            mine.append(token)

    def remove_push_token(self, user_id, token):
        self.tokens[user_id] = [t for t in self.tokens.get(user_id, []) if t != token]

    def push_tokens(self, user_id):
        return list(self.tokens.get(user_id, []))

    def set_display_name(self, user_id, name):
        self.names[user_id] = name

    def find_user_by_email(self, email):
        user_id = self.emails.get(email.strip().lower())
        return {"id": user_id, "email": email, "status": self.profile_status(user_id)} if user_id else None

    # AI Credits: same rules as the credit_* database functions (see the credit_wallet migration)
    def credits(self, user_id):
        return dict(self.wallets.get(user_id, {"balance": 0, "held": 0}))

    def credit_granted(self, user_id):
        return sum(e["amount"] for e in self.ledger if e["user_id"] == user_id and e["kind"] == "grant")

    def credit_entries(self, user_id, limit, before=None):
        own = [e for e in reversed(self.ledger) if e["user_id"] == user_id and (before is None or e["id"] < before)]
        return copy.deepcopy(own[:limit])

    def find_grant(self, user_id, key):
        return copy.deepcopy(next((e for e in self.ledger if e["user_id"] == user_id
                                   and e["operation_key"] == f"grant:{key}"), None))

    def _wallet(self, user_id):
        if not user_id or not self.user_exists(user_id):
            raise CreditError("WC404", "unknown user")
        return self.wallets.setdefault(user_id, {"balance": 0, "held": 0})

    def _append(self, user_id, wallet, **row):
        entry = {"id": len(self.ledger) + 1, "user_id": user_id, "balance_after": wallet["balance"],
                 "held_after": wallet["held"], "action": None, "job_id": None, "note": None, "granted_by": None,
                 "created_at": _now().isoformat(), **row}
        self.ledger.append(entry)
        return copy.deepcopy(entry)

    def _refuse_disabled(self, user_id):
        if user_id in self.disabled:
            raise CreditError("WC403", "this account is disabled")

    def credit_grant(self, user_id, amount, key, note, granted_by):
        if type(amount) is not int or amount <= 0:
            raise CreditError("WC422", "a grant must be a positive whole number of credits")
        if not (key or "").strip() or not (note or "").strip() or not (granted_by or "").strip():
            raise CreditError("WC422", "a grant needs an operation key, a reason and the admin who gave it")
        wallet = self._wallet(user_id)
        done = next((e for e in self.ledger if e["user_id"] == user_id and e["operation_key"] == f"grant:{key}"), None)
        if done:
            if done["amount"] == amount:
                return copy.deepcopy(done)
            raise CreditError("WC422", f"operation key {key} was already used for a different grant")
        self._refuse_disabled(user_id)
        wallet["balance"] += amount
        return self._append(user_id, wallet, kind="grant", amount=amount, operation_key=f"grant:{key}",
                            note=note.strip(), granted_by=granted_by.strip())

    def credit_reserve(self, user_id, job_id, action, amount):
        if not job_id or action not in ACTIONS or type(amount) is not int or amount <= 0:
            raise CreditError("WC422", "a reserve needs a job, a known action and a positive cost")
        wallet = self._wallet(user_id)
        hold = next((e for e in self.ledger if e["job_id"] == job_id and e["kind"] == "hold"), None)
        if hold:
            if (hold["user_id"], hold["action"], hold["amount"]) == (user_id, action, amount):
                return copy.deepcopy(hold)
            raise CreditError("WC422", f"job {job_id} already holds credits for a different operation")
        self._refuse_disabled(user_id)
        if wallet["balance"] - wallet["held"] < amount:
            raise CreditError("WC402", "not enough AI credits")
        wallet["held"] += amount
        return self._append(user_id, wallet, kind="hold", amount=amount, action=action, job_id=job_id,
                            operation_key=f"job:{job_id}:hold")

    def _end_hold(self, job_id, charge):
        hold = next((e for e in self.ledger if e["job_id"] == job_id and e["kind"] == "hold"), None)
        if hold is None:
            return []
        charge = hold["amount"] if charge is None else charge
        if type(charge) is not int or not 0 <= charge <= hold["amount"]:
            raise CreditError("WC422", f"a charge must be between 0 and the {hold['amount']} credits held")
        wallet = self._wallet(hold["user_id"])
        ended = [e for e in self.ledger if e["job_id"] == job_id and e["kind"] in ("charge", "release")]
        if ended:
            charged = sum(e["amount"] for e in ended if e["kind"] == "charge")
            if charged == charge:
                return copy.deepcopy(ended)
            raise CreditError("WC409", f"job {job_id} was already settled for {charged} credits")
        rows, common = [], {"action": hold["action"], "job_id": job_id}
        if charge:
            wallet["balance"] -= charge
            wallet["held"] -= charge
            rows.append(self._append(hold["user_id"], wallet, kind="charge", amount=charge,
                                     operation_key=f"job:{job_id}:charge", **common))
        if hold["amount"] > charge:
            wallet["held"] -= hold["amount"] - charge
            rows.append(self._append(hold["user_id"], wallet, kind="release", amount=hold["amount"] - charge,
                                     operation_key=f"job:{job_id}:release", **common))
        return rows

    def credit_settle(self, job_id, amount=None):
        return self._end_hold(job_id, amount)

    def credit_release(self, job_id):
        return self._end_hold(job_id, 0)

    def credit_reconcile(self, grace_seconds):
        from api.credits import charge_for
        rows = []
        for hold in [e for e in self.ledger if e["kind"] == "hold"]:
            if any(e["job_id"] == hold["job_id"] and e["kind"] in ("charge", "release") for e in self.ledger):
                continue
            job = self.jobs.get(hold["job_id"])
            if job is None:
                age = (_now() - datetime.fromisoformat(hold["created_at"])).total_seconds()
                if age >= grace_seconds:
                    rows += self._end_hold(hold["job_id"], 0)
            elif job["status"] in ("failed", "canceled"):
                rows += self._end_hold(hold["job_id"], 0)
            elif job["status"] == "succeeded":
                rows += self._end_hold(hold["job_id"], min(hold["amount"], charge_for(job, job["result"])))
        return rows

    # Admin lookups (sweeper only: not scoped to a user)
    def job_status(self, job_id):
        job = self.jobs.get(job_id)
        return job["status"] if job else None

    def job_kind(self, job_id):
        job = self.jobs.get(job_id)
        return job["kind"] if job else None

    # Jobs
    def _by_key(self, user_id, key):
        return next((copy.deepcopy(j) for j in self.jobs.values()
                     if j["user_id"] == user_id and j["idempotency_key"] == key), None)

    def job_by_key(self, user_id, key):
        return self._by_key(user_id, key)

    def create_job(self, user_id, kind, idempotency_key, input_path, item_id=None, job_id=None, cost_credits=None,
                   max_items=None, extra=None):
        existing = self._by_key(user_id, idempotency_key)  # the unique constraint
        if existing:
            return existing, False
        job = {"id": job_id or str(uuid.uuid4()), "user_id": user_id, "item_id": item_id, "kind": kind, "cost_credits": cost_credits, "max_items": max_items,
               "status": "queued", "idempotency_key": idempotency_key, "input_path": input_path, "result": None,
               "error": None, "attempts": 0, "max_attempts": 2, "locked_until": None,
               "created_at": _now() + timedelta(microseconds=len(self.jobs)), "started_at": None, "finished_at": None,
               "scan_job_id": None, "candidate_ids": None, **copy.deepcopy(extra or {})}
        self.jobs[job["id"]] = job
        return copy.deepcopy(job), True

    def get_job(self, user_id, job_id):
        job = self.jobs.get(job_id)
        return copy.deepcopy(job) if job and job["user_id"] == user_id else None

    def active_job(self, user_id, item_id, kind):
        return next((copy.deepcopy(j) for j in self.jobs.values() if j["user_id"] == user_id
                     and j["item_id"] == item_id and j["kind"] == kind and j["status"] in ACTIVE), None)

    def claim_job(self, lease_seconds):
        now = _now()
        for job in self.jobs.values():
            if job["status"] == "running" and job["locked_until"] < now and job["attempts"] >= job["max_attempts"]:
                job.update(status="failed", error=INTERRUPTED, finished_at=now, locked_until=None)
        claimable = [j for j in self.jobs.values() if j["status"] == "queued"
                     or (j["status"] == "running" and j["locked_until"] < now)]
        if not claimable:
            return None
        job = min(claimable, key=lambda j: j["created_at"])
        job.update(status="running", attempts=job["attempts"] + 1, locked_until=now + timedelta(seconds=lease_seconds),
                   started_at=job["started_at"] or now)
        return copy.deepcopy(job)

    def finish_job(self, job_id, status, result=None, error=None, failure_code=None):
        self.jobs[job_id].update(status=status, result=result, error=error, finished_at=_now(), locked_until=None,
                                 failure_code=failure_code)

    def retry_job(self, job_id, error):
        self.jobs[job_id].update(status="queued", error=error, locked_until=None)

    def set_job_progress(self, job_id, done, total):
        self.jobs[job_id]["progress"] = {"done": done, "total": total}

    def count_recent_jobs(self, user_id, kinds, seconds):
        since = _now() - timedelta(seconds=seconds)
        return sum(1 for j in self.jobs.values() if j["user_id"] == user_id and j["kind"] in kinds and j["created_at"] >= since)

    def count_jobs_since(self, kinds, since):
        """All accounts (admin view): jobs of these kinds created since `since`."""
        return sum(1 for j in self.jobs.values() if j["kind"] in kinds and j["created_at"] >= since)

    def count_failed_jobs_since(self, since):
        """All accounts (admin view): jobs that failed for good since `since`."""
        return sum(1 for j in self.jobs.values() if j["status"] == "failed" and j["finished_at"] and j["finished_at"] >= since)

    def queue_stats(self):
        queued = [j for j in self.jobs.values() if j["status"] == "queued"]
        oldest = min((j["created_at"] for j in queued), default=None)
        return {"queued": len(queued), "oldest_queued_seconds": 0 if oldest is None else round((_now() - oldest).total_seconds(), 1)}

    # Accounts
    def create_auth_user(self, email, password):
        user_id = str(uuid.uuid4())
        self.emails[email.strip().lower()] = user_id
        self.passwords[user_id] = password
        return user_id

    def update_auth_user(self, user_id, password, banned):
        self.passwords[user_id] = password
        (self.banned.add if banned else self.banned.discard)(user_id)

    def delete_account(self, user_id):
        """Like deleting the auth user: every row cascades away, then the user's files go."""
        self.deleted_users.add(user_id)
        self.items = {k: v for k, v in self.items.items() if v["user_id"] != user_id}
        self.jobs = {k: v for k, v in self.jobs.items() if v["user_id"] != user_id}
        self.wallets.pop(user_id, None)
        self.ledger = [e for e in self.ledger if e["user_id"] != user_id]
        self.events = [e for e in self.events if e["user_id"] != user_id]
        for call in self.ai_calls:  # like "on delete set null": the cost stays, the account and job go
            if call.get("user_id") == user_id:
                call.update(user_id=None, job_id=None)
        self.emails = {e: u for e, u in self.emails.items() if u != user_id}
        self.names.pop(user_id, None)
        self.tokens.pop(user_id, None)
        self.remove(self.list_paths(user_id))

    # Items
    def _visible(self, user_id, item_id):
        item = self.items.get(item_id)
        return item if item and item["user_id"] == user_id and item["deleted_at"] is None else None

    def list_items(self, user_id):
        # Outfit results waiting for review are not in the closet yet.
        own = [i for i in self.items.values() if i["user_id"] == user_id and i["deleted_at"] is None
               and i.get("review_state") in (None, "kept")]
        return copy.deepcopy(sorted(own, key=lambda i: i["created_at"], reverse=True))

    def get_item(self, user_id, item_id):
        return copy.deepcopy(self._visible(user_id, item_id))

    def pending_items(self, user_id):
        own = [i for i in self.items.values() if i["user_id"] == user_id and i["deleted_at"] is None
               and i.get("review_state") == "pending"]
        return copy.deepcopy(sorted(own, key=lambda i: i["created_at"], reverse=True))

    def insert_item(self, row):
        for item in self.items.values():
            same_piece = row.get("job_id") and (item["job_id"], item["piece_index"]) == (row["job_id"], row.get("piece_index"))
            same_legacy = row.get("legacy_key") and (item["user_id"], item["legacy_key"]) == (row["user_id"], row["legacy_key"])
            if same_piece or same_legacy:
                return copy.deepcopy(item)
        for key in ("source_path", "display_path", "cutout_path", "crop_path"):
            if row.get(key) and not row[key].startswith(row["user_id"] + "/"):
                raise ValueError(f"{key} outside the owner's folder")
        item = {"id": str(uuid.uuid4()), "job_id": None, "piece_index": None, "tier": None, "facts_original": None,
                "origin": "garment_photo", "review_state": None,
                "source_kind": "original", "cutout_path": None, "crop_path": None, "back": None, "turn": None,
                "legacy_key": None, "deleted_at": None, "created_at": _now() + timedelta(microseconds=len(self.items)),
                **copy.deepcopy(row)}
        item["updated_at"] = item["created_at"]
        self.items[item["id"]] = item
        return copy.deepcopy(item)

    def update_item(self, user_id, item_id, fields):
        item = self.items.get(item_id)
        if not item or item["user_id"] != user_id:
            return None
        if "facts" in fields and fields["facts"] != item["facts"] and item["facts_original"] is None:
            item["facts_original"] = item["facts"]
        item.update(copy.deepcopy(fields), updated_at=_now())
        return copy.deepcopy(item)

    def find_legacy(self, user_id, legacy_key):
        return next((copy.deepcopy(i) for i in self.items.values()
                     if i["user_id"] == user_id and i["legacy_key"] == legacy_key), None)

    # Files
    def upload(self, path, data, content_type):
        self.files[path] = data
        self.file_times[path] = _now()

    def download(self, path):
        return self.files[path]

    def remove(self, paths):
        for p in paths:
            self.files.pop(p, None)

    def sign(self, paths):
        return {p: f"{self.public_url}/{p}?token=signed" for p in paths}

    def list_files(self, prefix=""):
        prefix = prefix.rstrip("/") + "/" if prefix else ""
        return {p: self.file_times.get(p, _now()) for p in self.files if p.startswith(prefix)}

    def list_paths(self, prefix):
        return sorted(self.list_files(prefix))


    # Model calls (ai_calls): cost and latency per call, written by the worker
    def insert_ai_calls(self, rows):
        for row in rows:
            self.ai_calls.append({"created_at": _now(), **copy.deepcopy(row)})

    def purge_ai_calls(self, before):
        kept = [c for c in self.ai_calls if c["created_at"] >= before]
        removed, self.ai_calls = len(self.ai_calls) - len(kept), kept
        return removed

    # Activity events (api/activity.py)
    def insert_event(self, user_id, event, props):
        """False when a once-only event was already recorded (the database's unique index)."""
        return self.insert_events([{"user_id": user_id, "event": event, "props": props}]) == 1

    def insert_events(self, rows):
        """Rows already validated; a repeat of a once-only event or of an app event id is skipped. Rows written."""
        written = 0
        for row in rows:
            user, event, cid = row["user_id"], row["event"], row.get("client_event_id")
            if event in ONCE and any(e["user_id"] == user and e["event"] == event for e in self.events):
                continue
            if cid and any(e["user_id"] == user and e.get("client_event_id") == cid for e in self.events):
                continue
            self.events.append({"source": "app", **copy.deepcopy(row), "props": copy.deepcopy(row.get("props") or {}),
                                "created_at": _now() + timedelta(microseconds=len(self.events))})
            written += 1
        return written

    def has_event(self, user_id, event):
        return any(e["user_id"] == user_id and e["event"] == event for e in self.events)

    def count_recent_events(self, user_id, seconds):
        since = _now() - timedelta(seconds=seconds)
        return sum(1 for e in self.events if e["user_id"] == user_id and e["created_at"] >= since)

    def purge_events(self, before):
        kept = [e for e in self.events if e["created_at"] >= before]
        removed, self.events = len(self.events) - len(kept), kept
        return removed

    def activation_rows(self, since):
        """Admin view for scripts/activation_report.py: sign-ups since `since` and what they did."""
        users = {u for u, at in self.signups.items() if at >= since}
        return {
            "signups": [{"user_id": u, "created_at": self.signups[u]} for u in users],
            "items": [{"user_id": i["user_id"], "created_at": i["created_at"]} for i in self.items.values()
                      if i["user_id"] in users and i.get("review_state") in (None, "kept")],
            "events": [copy.deepcopy(e) for e in self.events if e["user_id"] in users],
            "paid_jobs": [{"user_id": j["user_id"], "created_at": j["created_at"]} for j in self.jobs.values()
                          if j["user_id"] in users and j["kind"] in PAID_KINDS],
        }

    def usage_rows(self, since):
        """Admin view for scripts/usage_report.py: everything since `since`, no personal content."""
        def recent(rows, field="created_at"):
            return [r for r in rows if r.get(field) and r[field] >= since]
        items = [{**_pick(i, REPORT_ITEM_FIELDS), "has_back": bool(i.get("back")),
                  "has_turn": (i.get("turn") or {}).get("state") == "done"} for i in self.items.values()]
        return {
            "now": _now(),
            "signups": [{"user_id": u, "created_at": at} for u, at in self.signups.items() if at >= since],
            "items": recent(items),
            "removed": [i for i in items if i["deleted_at"] and _as_time(i["deleted_at"]) >= since],
            "jobs": recent([_pick(j, REPORT_JOB_FIELDS) for j in self.jobs.values()]),
            "ledger": recent([_pick(e, REPORT_LEDGER_FIELDS) for e in self.ledger], "created_at"),
            "events": recent([_pick(e, REPORT_EVENT_FIELDS) for e in self.events]),
            "ai_calls": recent([_pick(c, REPORT_CALL_FIELDS) for c in self.ai_calls]),
        }

    def user_rows(self, user_id):
        """One account's history for the --user timeline: the same columns as usage_rows."""
        rows = self.usage_rows(datetime.min.replace(tzinfo=timezone.utc))
        mine = {k: [r for r in v if r.get("user_id") == user_id] for k, v in rows.items() if isinstance(v, list)}
        mine["signups"] = [{"user_id": user_id, "created_at": self.signups[user_id]}] if user_id in self.signups else []
        return {**mine, "now": rows["now"]}

    def find_user(self, email_or_id):
        key = (email_or_id or "").strip().lower()
        if key in self.emails:
            return self.emails[key]
        known = set(self.signups) | {j["user_id"] for j in self.jobs.values()} | {e["user_id"] for e in self.events}
        return email_or_id if email_or_id in known else None

# Columns the usage report reads (scripts/usage_report.py): ids, kinds, numbers and times — no facts, paths or text.
REPORT_ITEM_FIELDS = ("id", "user_id", "job_id", "created_at", "deleted_at", "origin", "review_state")
REPORT_JOB_FIELDS = ("id", "user_id", "kind", "status", "failure_code", "attempts", "cost_credits", "created_at", "finished_at")
REPORT_LEDGER_FIELDS = ("user_id", "kind", "amount", "action", "job_id", "created_at")
REPORT_EVENT_FIELDS = ("user_id", "event", "props", "source", "job_id", "item_id", "session_id", "app_version", "created_at")
REPORT_CALL_FIELDS = ("user_id", "job_id", "job_kind", "stage", "model", "status", "attempt", "fallback", "latency_ms",
                      "est_cost_usd", "created_at")


def _as_time(value):
    return _parse_time(value) if isinstance(value, str) else value


def _pick(row: dict, fields) -> dict:
    """The listed fields, with times as datetimes whichever way the store kept them."""
    out = {f: row.get(f) for f in fields}
    for key in ("created_at", "finished_at", "deleted_at"):
        if out.get(key) is not None:
            out[key] = _as_time(out[key])
    return out


class StoreError(Exception):
    pass


class SupabaseStore:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self.settings = settings
        headers = {"apikey": settings.secret_key, "Authorization": f"Bearer {settings.secret_key}"}
        self.http = client or httpx.Client(base_url=settings.supabase_url, headers=headers, timeout=60)

    def _ok(self, response: httpx.Response) -> httpx.Response:
        if response.status_code >= 400:
            # Never echo headers: they carry the secret key.
            raise StoreError(f"Supabase {response.request.method} {response.request.url.path} → {response.status_code}: {response.text[:300]}")
        return response

    def _rows(self, table, params):
        return self._ok(self.http.get(f"/rest/v1/{table}", params={"select": "*", **params})).json()

    def _one(self, table, params):
        rows = self._rows(table, {**params, "limit": "1"})
        return rows[0] if rows else None

    def _insert(self, table, row):
        r = self.http.post(f"/rest/v1/{table}", json=row, headers={"Prefer": "return=representation"})
        if r.status_code == 409:
            return None  # unique violation: the caller fetches the existing row
        return self._ok(r).json()[0]

    def _patch(self, table, params, fields):
        r = self.http.patch(f"/rest/v1/{table}", params=params, json=fields, headers={"Prefer": "return=representation"})
        rows = self._ok(r).json()
        return rows[0] if rows else None

    # Profiles
    def profile_status(self, user_id):
        row = self._one("profiles", {"id": f"eq.{user_id}"})
        return row["status"] if row else "active"

    def user_exists(self, user_id):
        return self._one("profiles", {"id": f"eq.{user_id}"}) is not None  # profiles go with the account

    def find_user_by_email(self, email):
        return self._one("profiles", {"email": f"eq.{email.strip().lower()}"})

    def display_name(self, user_id):
        row = self._one("profiles", {"id": f"eq.{user_id}"})
        return row.get("display_name") if row else None

    def set_display_name(self, user_id, name):
        self._patch("profiles", {"id": f"eq.{user_id}"}, {"display_name": name})

    def add_push_token(self, user_id, token):
        r = self.http.post("/rest/v1/push_tokens", json={"user_id": user_id, "token": token},
                           headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        self._ok(r)

    def remove_push_token(self, user_id, token):
        self._ok(self.http.delete("/rest/v1/push_tokens", params={"user_id": f"eq.{user_id}", "token": f"eq.{token}"}))

    def push_tokens(self, user_id):
        return [r["token"] for r in self._rows("push_tokens", {"user_id": f"eq.{user_id}"})]

    # AI Credits: reads filter by the user; every change goes through a credit_* database function
    def credits(self, user_id):
        row = self._one("credit_wallets", {"user_id": f"eq.{user_id}"})
        return {"balance": row["balance"], "held": row["held"]} if row else {"balance": 0, "held": 0}

    def credit_granted(self, user_id):
        rows = self._rows("credit_ledger", {"user_id": f"eq.{user_id}", "kind": "eq.grant", "select": "amount"})
        return sum(r["amount"] for r in rows)

    def credit_entries(self, user_id, limit, before=None):
        params = {"user_id": f"eq.{user_id}", "order": "id.desc", "limit": str(limit)}
        if before is not None:
            params["id"] = f"lt.{before}"
        return self._rows("credit_ledger", params)

    def find_grant(self, user_id, key):
        return self._one("credit_ledger", {"user_id": f"eq.{user_id}", "operation_key": f"eq.grant:{key}"})

    def _credit_rpc(self, name, args):
        r = self.http.post(f"/rest/v1/rpc/{name}", json=args)
        if r.status_code >= 400:
            try:
                body = r.json()
            except ValueError:
                body = {}
            if str(body.get("code", "")).startswith("WC"):
                raise CreditError(body["code"], body.get("message", ""))
        return self._ok(r).json()

    def credit_grant(self, user_id, amount, key, note, granted_by):
        return self._credit_rpc("credit_grant", {"p_user_id": user_id, "p_amount": amount, "p_operation_key": key,
                                                 "p_note": note, "p_granted_by": granted_by})[0]

    def credit_reserve(self, user_id, job_id, action, amount):
        return self._credit_rpc("credit_reserve", {"p_user_id": user_id, "p_job_id": job_id, "p_action": action,
                                                   "p_amount": amount})[0]

    def credit_settle(self, job_id, amount=None):
        return self._credit_rpc("credit_settle", {"p_job_id": job_id, "p_amount": amount})

    def credit_reconcile(self, grace_seconds):
        return self._credit_rpc("credit_reconcile", {"p_grace_seconds": grace_seconds})

    def credit_release(self, job_id):
        return self._credit_rpc("credit_release", {"p_job_id": job_id})

    def credit_drift(self):
        return self._ok(self.http.post("/rest/v1/rpc/credit_wallet_drift", json={})).json()

    # Admin lookups (sweeper only: not scoped to a user)
    def job_status(self, job_id):
        row = self._one("generation_jobs", {"id": f"eq.{job_id}"})
        return row["status"] if row else None

    def job_kind(self, job_id):
        row = self._one("generation_jobs", {"id": f"eq.{job_id}"})
        return row["kind"] if row else None

    # Jobs
    def job_by_key(self, user_id, key):
        return self._one("generation_jobs", {"user_id": f"eq.{user_id}", "idempotency_key": f"eq.{key}"})

    def create_job(self, user_id, kind, idempotency_key, input_path, item_id=None, job_id=None, cost_credits=None,
                   max_items=None, extra=None):
        row = {"user_id": user_id, "kind": kind, "idempotency_key": idempotency_key, "input_path": input_path,
               "item_id": item_id, "cost_credits": cost_credits, **(extra or {})}
        if max_items is not None:  # only sent when billing is on, so a database without M2 still works
            row["max_items"] = max_items
        if job_id:
            row["id"] = job_id
        created = self._insert("generation_jobs", row)
        return (created, True) if created else (self.job_by_key(user_id, idempotency_key), False)

    def get_job(self, user_id, job_id):
        return self._one("generation_jobs", {"id": f"eq.{job_id}", "user_id": f"eq.{user_id}"})

    def active_job(self, user_id, item_id, kind):
        return self._one("generation_jobs", {"user_id": f"eq.{user_id}", "item_id": f"eq.{item_id}",
                                             "kind": f"eq.{kind}", "status": "in.(queued,running)"})

    def claim_job(self, lease_seconds):
        rows = self._ok(self.http.post("/rest/v1/rpc/claim_generation_job", json={"lease_seconds": lease_seconds})).json()
        return rows[0] if rows else None

    def finish_job(self, job_id, status, result=None, error=None, failure_code=None):
        fields = {"status": status, "result": result, "error": error, "finished_at": _now().isoformat(), "locked_until": None}
        if failure_code:  # only failed jobs: a success never depends on the ai_calls migration being applied
            fields["failure_code"] = failure_code
        self._patch("generation_jobs", {"id": f"eq.{job_id}"}, fields)

    def retry_job(self, job_id, error):
        self._patch("generation_jobs", {"id": f"eq.{job_id}"}, {"status": "queued", "error": error, "locked_until": None})

    # Items
    def list_items(self, user_id):
        # Outfit results waiting for review (review_state 'pending') are not in the closet yet. Filtered here,
        # not in the query, so the closet still loads on a database without the outfit migration.
        rows = self._rows("wardrobe_items", {"user_id": f"eq.{user_id}", "deleted_at": "is.null", "order": "created_at.desc"})
        return [r for r in rows if r.get("review_state") in (None, "kept")]

    def get_item(self, user_id, item_id):
        return self._one("wardrobe_items", {"id": f"eq.{item_id}", "user_id": f"eq.{user_id}", "deleted_at": "is.null"})

    def pending_items(self, user_id):
        return self._rows("wardrobe_items", {"user_id": f"eq.{user_id}", "deleted_at": "is.null",
                                             "review_state": "eq.pending", "order": "created_at.desc"})

    def insert_item(self, row):
        created = self._insert("wardrobe_items", row)
        if created:
            return created
        if row.get("job_id"):
            return self._one("wardrobe_items", {"job_id": f"eq.{row['job_id']}", "piece_index": f"eq.{row['piece_index']}"})
        return self.find_legacy(row["user_id"], row["legacy_key"])

    def update_item(self, user_id, item_id, fields):
        return self._patch("wardrobe_items", {"id": f"eq.{item_id}", "user_id": f"eq.{user_id}"}, fields)

    def find_legacy(self, user_id, legacy_key):
        return self._one("wardrobe_items", {"user_id": f"eq.{user_id}", "legacy_key": f"eq.{legacy_key}"})

    def set_job_progress(self, job_id, done, total):
        self._patch("generation_jobs", {"id": f"eq.{job_id}"}, {"progress": {"done": done, "total": total}})

    def count_recent_jobs(self, user_id, kinds, seconds):
        since = (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()
        rows = self._rows("generation_jobs", {"select": "id", "user_id": f"eq.{user_id}",
                                              "kind": f"in.({','.join(kinds)})", "created_at": f"gte.{since}"})
        return len(rows)

    def count_jobs_since(self, kinds, since):
        r = self.http.get("/rest/v1/generation_jobs", params={"select": "id", "kind": f"in.({','.join(kinds)})",
                                                              "created_at": f"gte.{since.isoformat()}"},
                          headers={"Prefer": "count=exact", "Range": "0-0"})
        self._ok(r)
        total = r.headers.get("content-range", "*/0").rsplit("/", 1)[-1]
        return int(total) if total.isdigit() else len(r.json())

    def count_failed_jobs_since(self, since):
        r = self.http.get("/rest/v1/generation_jobs", params={"select": "id", "status": "eq.failed",
                                                              "finished_at": f"gte.{since.isoformat()}"},
                          headers={"Prefer": "count=exact", "Range": "0-0"})
        self._ok(r)
        total = r.headers.get("content-range", "*/0").rsplit("/", 1)[-1]
        return int(total) if total.isdigit() else len(r.json())

    def queue_stats(self):
        rows = self._rows("generation_jobs", {"select": "created_at", "status": "eq.queued", "order": "created_at.asc", "limit": "1000"})
        if not rows:
            return {"queued": 0, "oldest_queued_seconds": 0}
        oldest = datetime.fromisoformat(rows[0]["created_at"].replace("Z", "+00:00"))
        return {"queued": len(rows), "oldest_queued_seconds": round((datetime.now(timezone.utc) - oldest).total_seconds(), 1)}

    # Accounts
    def create_auth_user(self, email, password):
        """A confirmed account that signs in with a password (the App Review demo account); its profile
        and wallet are created by the sign-up trigger like any other account's."""
        body = {"email": email.strip().lower(), "password": password, "email_confirm": True}
        return self._ok(self.http.post("/auth/v1/admin/users", json=body)).json()["id"]

    def update_auth_user(self, user_id, password, banned):
        """Sets the password and blocks (banned) or unblocks sign-in; a blocked account can't refresh its session either."""
        body = {"password": password, "ban_duration": BANNED_FOR if banned else "none"}
        self._ok(self.http.put(f"/auth/v1/admin/users/{quote(user_id, safe='')}", json=body))

    def delete_account(self, user_id):
        """Deletes the auth user (profile, items, jobs, wallet and ledger cascade with it), then removes
        the user's files. Files left behind by a failure here are caught by scripts/sweep_storage.py,
        which removes files of deleted accounts."""
        self._ok(self.http.delete(f"/auth/v1/admin/users/{quote(user_id, safe='')}"))
        paths = self.list_paths(user_id)
        for start in range(0, len(paths), 100):
            self.remove(paths[start:start + 100])

    # Files
    def _object(self, path):
        return f"/storage/v1/object/{BUCKET}/{quote(path, safe='/')}"

    def upload(self, path, data, content_type):
        self._ok(self.http.post(self._object(path), content=data, headers={"Content-Type": content_type, "x-upsert": "true"}))

    def download(self, path):
        return self._ok(self.http.get(self._object(path))).content

    def remove(self, paths):
        if paths:
            self._ok(self.http.request("DELETE", f"/storage/v1/object/{BUCKET}", json={"prefixes": list(paths)}))

    def list_files(self, prefix=""):
        """Every file under prefix (recursive) with its last-modified time."""
        prefix = prefix.rstrip("/")
        files, offset = {}, 0
        while True:
            entries = self._ok(self.http.post(f"/storage/v1/object/list/{BUCKET}",
                                              json={"prefix": prefix, "limit": 1000, "offset": offset})).json()
            for entry in entries:
                path = f"{prefix}/{entry['name']}" if prefix else entry["name"]
                if entry.get("id"):
                    files[path] = datetime.fromisoformat(entry["updated_at"].replace("Z", "+00:00"))
                else:
                    files.update(self.list_files(path))
            if len(entries) < 1000:
                return files
            offset += 1000

    def list_paths(self, prefix):
        return sorted(self.list_files(prefix))

    def sign(self, paths):
        if not paths:
            return {}
        rows = self._ok(self.http.post(f"/storage/v1/object/sign/{BUCKET}",
                                       json={"expiresIn": SIGNED_URL_SECONDS, "paths": list(paths)})).json()
        return {r["path"]: f"{self.settings.public_url}/storage/v1{r['signedURL']}" for r in rows if r.get("signedURL")}

    # Model calls (ai_calls): backend only
    def insert_ai_calls(self, rows):
        if rows:
            self._ok(self.http.post("/rest/v1/ai_calls", json=[
                {**r, "created_at": r["created_at"].isoformat()} if isinstance(r.get("created_at"), datetime) else r
                for r in rows], headers={"Prefer": "return=minimal"}))

    def purge_ai_calls(self, before):
        r = self.http.delete("/rest/v1/ai_calls", params={"created_at": f"lt.{before.isoformat()}"},
                             headers={"Prefer": "count=exact,return=minimal"})
        total = self._ok(r).headers.get("content-range", "*/0").rsplit("/", 1)[-1]
        return int(total) if total.isdigit() else 0

    # Activity events: written and read by the backend only (api/activity.py)
    def insert_event(self, user_id, event, props):
        return self._insert("activity_events", {"user_id": user_id, "event": event, "props": props}) is not None

    def insert_events(self, rows):
        """One request for the batch; if a row repeats a once-only event or an app event id (409), the rows go
        one by one so the others are still written. Rows written."""
        if not rows:
            return 0
        body = [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in r.items()} for r in rows]
        r = self.http.post("/rest/v1/activity_events", json=body, headers={"Prefer": "return=minimal"})
        if r.status_code != 409:
            self._ok(r)
            return len(rows)
        return sum(1 for row in body if self._insert("activity_events", row) is not None)

    def has_event(self, user_id, event):
        return self._one("activity_events", {"select": "id", "user_id": f"eq.{user_id}", "event": f"eq.{event}"}) is not None

    def count_recent_events(self, user_id, seconds):
        since = (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()
        return len(self._rows("activity_events", {"select": "id", "user_id": f"eq.{user_id}", "created_at": f"gte.{since}"}))

    def purge_events(self, before):
        r = self.http.delete("/rest/v1/activity_events", params={"created_at": f"lt.{before.isoformat()}"},
                             headers={"Prefer": "return=representation"})
        return len(self._ok(r).json())

    def activation_rows(self, since):
        at = f"gte.{since.isoformat()}"
        signups = [{"user_id": r["id"], "created_at": _parse_time(r["created_at"])}
                   for r in self._rows("profiles", {"select": "id,created_at", "created_at": at})]
        users = {s["user_id"] for s in signups}
        def mine(rows):
            return [{**r, "created_at": _parse_time(r["created_at"])} for r in rows if r["user_id"] in users]
        items = [r for r in self._rows("wardrobe_items", {"select": "user_id,created_at,review_state", "created_at": at})
                 if r.get("review_state") in (None, "kept")]
        return {
            "signups": signups,
            "items": mine([{"user_id": r["user_id"], "created_at": r["created_at"]} for r in items]),
            "events": mine(self._rows("activity_events", {"select": "user_id,event,props,created_at", "created_at": at})),
            "paid_jobs": mine(self._rows("generation_jobs", {"select": "user_id,created_at", "created_at": at,
                                                             "kind": f"in.({','.join(PAID_KINDS)})"})),
        }

    def _report(self, table, fields, params):
        rows, page = [], 1000
        while True:
            batch = self._rows(table, {"select": ",".join(fields), "order": "created_at.asc",
                                       "limit": str(page), "offset": str(len(rows)), **params})
            rows += batch
            if len(batch) < page:
                break
        for r in rows:
            for key in ("created_at", "finished_at", "deleted_at"):
                if r.get(key):
                    r[key] = _parse_time(r[key])
        return rows

    def usage_rows(self, since, user_id=None):
        at = {"created_at": f"gte.{since.isoformat()}"}
        mine = {"user_id": f"eq.{user_id}"} if user_id else {}
        item_fields = REPORT_ITEM_FIELDS + ("back", "turn")
        items = [{**_pick(i, REPORT_ITEM_FIELDS), "has_back": bool(i.get("back")),
                  "has_turn": (i.get("turn") or {}).get("state") == "done"}
                 for i in self._report("wardrobe_items", item_fields, {**at, **mine})]
        removed = [{**_pick(i, REPORT_ITEM_FIELDS), "has_back": False, "has_turn": False}
                   for i in self._report("wardrobe_items", REPORT_ITEM_FIELDS,
                                         {"deleted_at": f"gte.{since.isoformat()}", **mine})]
        signups = [{"user_id": r["id"], "created_at": r["created_at"]} for r in
                   self._report("profiles", ("id", "created_at"), {**at, **({"id": f"eq.{user_id}"} if user_id else {})})]
        return {
            "now": datetime.now(timezone.utc),
            "signups": signups, "items": items, "removed": removed,
            "jobs": self._report("generation_jobs", REPORT_JOB_FIELDS, {**at, **mine}),
            "ledger": self._report("credit_ledger", REPORT_LEDGER_FIELDS, {**at, **mine}),
            "events": self._report("activity_events", REPORT_EVENT_FIELDS, {**at, **mine}),
            "ai_calls": self._report("ai_calls", REPORT_CALL_FIELDS, {**at, **mine}),
        }

    def user_rows(self, user_id):
        return self.usage_rows(datetime(2000, 1, 1, tzinfo=timezone.utc), user_id=user_id)

    def find_user(self, email_or_id):
        key = (email_or_id or "").strip()
        row = self._one("profiles", {"select": "id", "email": f"eq.{key.lower()}"}) if "@" in key else \
            self._one("profiles", {"select": "id", "id": f"eq.{key}"}) if len(key) == 36 else None
        return row["id"] if row else None


def get_store():
    """The request's store; the multi-user app overrides this with its SupabaseStore."""
    raise RuntimeError("no store configured")
