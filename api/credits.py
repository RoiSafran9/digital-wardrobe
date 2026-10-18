"""AI Credits hooks: what each job costs and the gate that will charge for it.

Billing is off until a price list is configured (WARDROBE_CREDIT_PRICES, e.g. '{"garment": 1, "turn": 3}').
Prices are a product decision and are never hardcoded here. The gate is where a wallet and an
append-only ledger plug in later (see docs/superpowers/specs/2026-10-18-credits-readiness.md);
NoCharge, the default, charges nothing.
"""
import json
import os
from functools import lru_cache
from typing import Mapping, Protocol

ACTIONS = ("garment", "back", "turn")


def load_prices(env: Mapping[str, str] = os.environ) -> dict[str, int]:
    raw = env.get("WARDROBE_CREDIT_PRICES", "").strip()
    if not raw:
        return {}
    try:
        prices = json.loads(raw)
    except ValueError as e:
        raise RuntimeError("WARDROBE_CREDIT_PRICES must be JSON like {\"garment\": 1}") from e
    if not isinstance(prices, dict) or not all(
            key in ACTIONS and type(value) is int and value >= 0 for key, value in prices.items()):
        raise RuntimeError(f"WARDROBE_CREDIT_PRICES may only set whole, non-negative prices for {', '.join(ACTIONS)}")
    return prices


def job_cost(prices: dict[str, int], kind: str) -> int | None:
    """Credits a job of this kind costs; None while billing is off."""
    if not prices:
        return None
    return prices.get(kind, 0)


class InsufficientCredits(Exception):
    pass


class CreditError(Exception):
    """A wallet operation the database refused. code is its SQLSTATE: WC402 not enough credits,
    WC403 disabled account, WC404 unknown user, WC409 the job's hold already ended the other way,
    WC422 invalid input or a key reused for a different operation."""
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class CreditGate(Protocol):
    def reserve(self, user_id: str, job_id: str, kind: str, cost: int | None) -> None:
        """Hold the job's cost before the job exists; raise InsufficientCredits to refuse it."""

    def release(self, job_id: str) -> None:
        """Drop a hold whose job was never created (e.g. a repeated request)."""

    def settle(self, job_id: str) -> None:
        """The job succeeded: the hold becomes a charge."""

    def refund(self, job_id: str) -> None:
        """The job failed for good: give the hold back."""


class NoCharge:
    def reserve(self, user_id, job_id, kind, cost):
        pass

    def release(self, job_id):
        pass

    def settle(self, job_id):
        pass

    def refund(self, job_id):
        pass


@lru_cache
def get_prices() -> dict[str, int]:
    return load_prices()


def get_gate() -> CreditGate:
    return NoCharge()
