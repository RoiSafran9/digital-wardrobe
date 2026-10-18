import pytest
from api.credits import NoCharge, job_cost, load_prices


def test_no_price_list_means_billing_is_off():
    assert load_prices({}) == {}
    assert job_cost({}, "garment") is None


def test_a_price_list_sets_each_actions_cost():
    prices = load_prices({"WARDROBE_CREDIT_PRICES": '{"garment": 2, "back": 1, "turn": 5}'})
    assert prices == {"garment": 2, "back": 1, "turn": 5}
    assert job_cost(prices, "turn") == 5


def test_an_action_left_out_of_the_list_is_free():
    assert job_cost(load_prices({"WARDROBE_CREDIT_PRICES": '{"turn": 3}'}), "back") == 0


@pytest.mark.parametrize("raw", ["not json", "[1, 2]", '{"garment": -1}', '{"garment": 1.5}', '{"outfit": 1}', '{"garment": true}'])
def test_a_malformed_price_list_stops_the_server(raw):
    with pytest.raises(RuntimeError, match="WARDROBE_CREDIT_PRICES"):
        load_prices({"WARDROBE_CREDIT_PRICES": raw})


def test_the_default_gate_charges_nothing():
    gate = NoCharge()
    gate.reserve("user", "job", "garment", 3)
    gate.release("job"); gate.settle("job"); gate.refund("job")
