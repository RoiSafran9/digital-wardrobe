"""AI Credits: what each AI action costs, and the gate that holds and charges for it.

Billing is OFF unless the server starts with WARDROBE_BILLING=on. Then WARDROBE_CREDIT_PRICES must
price every action (e.g. '{"garment": 1, "back": 1, "turn": 3}') or the server refuses to start:
an unpriced action is never silently free. Prices are a product decision and are never hardcoded here.

Billing is per action (owner decision, docs/CREDITS.md): one front image (`garment`), one back image
(`back`), one 360 (`turn`). A photo may hold several garments, so before capturing the user approves
how many fronts they will pay for (max_fronts, default 1): the job holds price × max_fronts, makes at
most that many, and is charged only for the fronts it made. The wallet lives in Postgres
(credit_* functions, see supabase/migrations/*credit*); WalletGate calls it, NoCharge ignores it.
"""
import json
import logging
import os
from functools import lru_cache
from typing import Mapping, Protocol

ACTIONS = ("garment", "back", "turn")
# Job kinds that are never charged (Outfit Photo scans: detection and previews are free to the user).
FREE_KINDS = ("outfit_scan",)
# Job kinds billed as another action: an Outfit Photo generate job makes front images, one per picked garment.
ACTION_OF = {"outfit_generate": "garment", "outfit_regenerate": "garment"}


def action_for(kind: str) -> str:
    """The priced action a job kind is billed as (its own name unless mapped)."""
    return ACTION_OF.get(kind, kind)
MAX_FRONTS = 20  # matches the generation_jobs.max_items check
RECONCILE_GRACE_SECONDS = 900  # a hold whose job never appeared is released after this

log = logging.getLogger("wardrobe.credits")


def _parse_prices(raw: str) -> dict[str, int]:
    try:
        prices = json.loads(raw)
    except ValueError as e:
        raise RuntimeError("WARDROBE_CREDIT_PRICES must be JSON like {\"garment\": 1}") from e
    if not isinstance(prices, dict) or not all(
            key in ACTIONS and type(value) is int and value >= 0 for key, value in prices.items()):
        raise RuntimeError(f"WARDROBE_CREDIT_PRICES may only set whole, non-negative prices for {', '.join(ACTIONS)}")
    return prices


def load_prices(env: Mapping[str, str] = os.environ) -> dict[str, int]:
    """The price list while billing is on; {} while it is off (the default)."""
    raw = env.get("WARDROBE_CREDIT_PRICES", "").strip()
    prices = _parse_prices(raw) if raw else {}  # a malformed list stops startup either way
    if env.get("WARDROBE_BILLING", "").strip().lower() != "on":
        if prices:
            log.warning("WARDROBE_CREDIT_PRICES is set but WARDROBE_BILLING is not on: billing stays off")
        return {}
    missing = [action for action in ACTIONS if action not in prices]
    if missing:
        raise RuntimeError(f"WARDROBE_BILLING=on needs WARDROBE_CREDIT_PRICES to price every action; missing: {', '.join(missing)}")
    return prices


def job_cost(prices: dict[str, int], kind: str) -> int | None:
    """Credits one action of this kind costs; None while billing is off. Unpriced is an error, not free."""
    if not prices or kind in FREE_KINDS:
        return None
    action = action_for(kind)
    if action not in prices:
        raise RuntimeError(f"no AI Credits price for {action!r}")
    return prices[action]


def hold_amount(cost: int | None, max_items: int | None) -> int | None:
    """What a job holds when it is queued: its price × the fronts approved (one for back / 360)."""
    return None if cost is None else cost * (max_items or 1)


def charge_for(job: dict, result: dict | None) -> int:
    """What a finished job is charged: price × the actions it delivered, capped at what was approved.
    Must match public.credit_job_charge, which reconcile uses."""
    delivered = len((result or {}).get("item_ids") or [])
    return (job.get("cost_credits") or 0) * min(delivered, job.get("max_items") or 1)


class InsufficientCredits(Exception):
    pass


class CreditError(Exception):
    """A wallet operation the database refused. code is its SQLSTATE: WC402 not enough credits,
    WC403 disabled account, WC404 unknown user, WC409 the job's hold already ended differently,
    WC422 invalid input or a key reused for a different operation."""
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class CreditGate(Protocol):
    def reserve(self, user_id: str, job_id: str, kind: str, cost: int | None) -> None:
        """Hold the job's cost before the job exists; raise InsufficientCredits to refuse it."""

    def release(self, job_id: str) -> None:
        """Drop a hold whose job was never created (e.g. a repeated request)."""

    def settle(self, job_id: str, amount: int) -> None:
        """The job finished: charge `amount` of its hold, give the rest back."""

    def refund(self, job_id: str) -> None:
        """The job failed for good: give the whole hold back."""

    def reconcile(self) -> int:
        """End holds the worker never ended (expired, crashed, never created). Returns ledger rows written."""


class NoCharge:
    def reserve(self, user_id, job_id, kind, cost):
        pass

    def release(self, job_id):
        pass

    def settle(self, job_id, amount):
        pass

    def refund(self, job_id):
        pass

    def reconcile(self):
        return 0


class WalletGate:
    """Holds and charges credits in the user's wallet (only when WARDROBE_BILLING=on)."""
    def __init__(self, store, grace_seconds: int = RECONCILE_GRACE_SECONDS):
        self.store, self.grace_seconds = store, grace_seconds

    def reserve(self, user_id, job_id, kind, cost):
        if not cost:
            return  # a free action holds nothing
        try:
            self.store.credit_reserve(user_id, job_id, kind, cost)
        except CreditError as e:
            if e.code == "WC402":
                raise InsufficientCredits() from e
            raise

    def release(self, job_id):
        self.store.credit_release(job_id)

    def settle(self, job_id, amount):
        self.store.credit_settle(job_id, amount)

    def refund(self, job_id):
        self.store.credit_release(job_id)

    def reconcile(self):
        return len(self.store.credit_reconcile(self.grace_seconds))


@lru_cache
def get_prices() -> dict[str, int]:
    return load_prices()


def get_gate() -> CreditGate:
    return NoCharge()
