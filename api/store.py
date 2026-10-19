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
from api.credits import ACTIONS, CreditError

BUCKET = "wardrobe"
SIGNED_URL_SECONDS = 3600
ACTIVE = ("queued", "running")
INTERRUPTED = "Interrupted — try again"


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

    def finish_job(self, job_id, status, result=None, error=None):
        self.jobs[job_id].update(status=status, result=result, error=error, finished_at=_now(), locked_until=None)

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

    def queue_stats(self):
        queued = [j for j in self.jobs.values() if j["status"] == "queued"]
        oldest = min((j["created_at"] for j in queued), default=None)
        return {"queued": len(queued), "oldest_queued_seconds": 0 if oldest is None else round((_now() - oldest).total_seconds(), 1)}

    # Accounts
    def delete_account(self, user_id):
        """Like deleting the auth user: every row cascades away, then the user's files go."""
        self.deleted_users.add(user_id)
        self.items = {k: v for k, v in self.items.items() if v["user_id"] != user_id}
        self.jobs = {k: v for k, v in self.jobs.items() if v["user_id"] != user_id}
        self.wallets.pop(user_id, None)
        self.ledger = [e for e in self.ledger if e["user_id"] != user_id]
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

    def finish_job(self, job_id, status, result=None, error=None):
        self._patch("generation_jobs", {"id": f"eq.{job_id}"}, {"status": status, "result": result, "error": error,
                                                                 "finished_at": _now().isoformat(), "locked_until": None})

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

    def queue_stats(self):
        rows = self._rows("generation_jobs", {"select": "created_at", "status": "eq.queued", "order": "created_at.asc", "limit": "1000"})
        if not rows:
            return {"queued": 0, "oldest_queued_seconds": 0}
        oldest = datetime.fromisoformat(rows[0]["created_at"].replace("Z", "+00:00"))
        return {"queued": len(rows), "oldest_queued_seconds": round((datetime.now(timezone.utc) - oldest).total_seconds(), 1)}

    # Accounts
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


def get_store():
    """The request's store; the multi-user app overrides this with its SupabaseStore."""
    raise RuntimeError("no store configured")
