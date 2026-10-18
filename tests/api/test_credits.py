import pytest
from api.credits import (CreditError, InsufficientCredits, NoCharge, WalletGate, charge_for, hold_amount, job_cost,
                         load_prices)
from api.store import MemoryStore

A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ALL = '{"garment": 2, "back": 1, "turn": 5}'


def test_billing_is_off_by_default():
    assert load_prices({}) == {}
    assert job_cost({}, "garment") is None


def test_a_price_list_alone_does_not_turn_billing_on():
    assert load_prices({"WARDROBE_CREDIT_PRICES": ALL}) == {}


def test_billing_on_uses_the_price_list():
    prices = load_prices({"WARDROBE_BILLING": "on", "WARDROBE_CREDIT_PRICES": ALL})
    assert prices == {"garment": 2, "back": 1, "turn": 5}
    assert job_cost(prices, "turn") == 5


@pytest.mark.parametrize("raw", ["", '{"turn": 3}', '{"garment": 1, "back": 1}'])
def test_billing_on_with_an_unpriced_action_stops_the_server(raw):
    with pytest.raises(RuntimeError, match="WARDROBE_CREDIT_PRICES"):
        load_prices({"WARDROBE_BILLING": "on", "WARDROBE_CREDIT_PRICES": raw})


def test_an_unpriced_action_is_never_free():
    with pytest.raises(RuntimeError, match="no AI Credits price"):
        job_cost({"garment": 1}, "turn")


@pytest.mark.parametrize("raw", ["not json", "[1, 2]", '{"garment": -1}', '{"garment": 1.5}', '{"outfit": 1}', '{"garment": true}'])
def test_a_malformed_price_list_stops_the_server(raw):
    with pytest.raises(RuntimeError, match="WARDROBE_CREDIT_PRICES"):
        load_prices({"WARDROBE_CREDIT_PRICES": raw})


def test_a_job_holds_its_price_times_the_fronts_approved():
    assert hold_amount(None, 3) is None
    assert hold_amount(2, 3) == 6 and hold_amount(3, None) == 3


@pytest.mark.parametrize("made, max_items, cost, charged", [
    (2, 3, 1, 2),     # 3 approved, 2 made: charged for 2
    (5, 2, 1, 2),     # never more than approved
    (0, 2, 1, 0),     # nothing made, nothing charged
    (1, None, 3, 3),  # back / 360: one action
    (1, 1, None, 0),  # billing was off for this job
])
def test_a_job_is_charged_for_what_it_delivered(made, max_items, cost, charged):
    job = {"cost_credits": cost, "max_items": max_items}
    assert charge_for(job, {"item_ids": [f"i{n}" for n in range(made)]}) == charged
    assert charge_for(job, None) == 0


def test_the_default_gate_charges_nothing():
    gate = NoCharge()
    gate.reserve("user", "job", "garment", 3)
    gate.release("job"); gate.settle("job", 3); gate.refund("job")
    assert gate.reconcile() == 0


def test_the_wallet_gate_holds_charges_and_gives_back():
    store = MemoryStore()
    store.credit_grant(A, 5, "k", "test", "owner")
    gate = WalletGate(store)
    gate.reserve(A, "job-1", "garment", 3)
    assert store.credits(A) == {"balance": 5, "held": 3}
    gate.settle("job-1", 2)
    assert store.credits(A) == {"balance": 3, "held": 0}
    gate.reserve(A, "job-2", "turn", 3)
    gate.refund("job-2")
    assert store.credits(A) == {"balance": 3, "held": 0}
    gate.reserve(A, "job-3", "back", 0)  # a free action holds nothing
    assert store.ledger[-1]["job_id"] == "job-2"


def test_the_wallet_gate_refuses_when_credits_run_out():
    store = MemoryStore()
    with pytest.raises(InsufficientCredits):
        WalletGate(store).reserve(A, "job-1", "garment", 1)


def test_the_wallet_gate_passes_other_refusals_on():
    store = MemoryStore()
    store.disabled.add(A)
    with pytest.raises(CreditError):
        WalletGate(store).reserve(A, "job-1", "garment", 1)
