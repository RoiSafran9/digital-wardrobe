"""POST /v1/outfit-suggestions and /v1/outfit-suggestions/swap-options: ownership, cross-account
isolation, the feature flag, and that neither route ever touches credits or starts a job."""
import pytest
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, as_user, v1_client


def _field(value):
    return {"value": value, "confidence": 0.8, "basis": "observed"}


def _facts(category, colors=()):
    return {"category": _field(category), "colors": _field(list(colors)), "pattern": _field("solid"),
            "visible_text": _field(""), "trims": _field("none"), "visible_parts": _field(["front"]),
            "occluded_parts": _field([])}


def add_item(store, user, category, **extra):
    row = {"user_id": user, "tier": "high", "facts": _facts(category),
           "source_path": f"{user}/items/{category}/source.jpg", "display_path": f"{user}/items/{category}/generated.png",
           "crop_path": f"{user}/items/{category}/crop.png", "cutout_path": f"{user}/items/{category}/cutout.png", **extra}
    return store.insert_item(row)


@pytest.fixture
def store(monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT_BUILDER", "on")
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def test_flag_off_answers_404_like_an_unknown_route(monkeypatch, store):
    monkeypatch.delenv("WARDROBE_OUTFIT_BUILDER", raising=False)
    client = v1_client(store)
    assert client.post("/v1/outfit-suggestions", json={}, headers=as_user(A)).status_code == 404


def test_needs_sign_in(client):
    assert client.post("/v1/outfit-suggestions", json={}).status_code == 401


def test_defaults_to_any_and_still_returns_a_look(client, store):
    add_item(store, A, "shirt")
    add_item(store, A, "chinos")
    r = client.post("/v1/outfit-suggestions", json={}, headers=as_user(A))
    assert r.status_code == 200
    body = r.json()
    assert len(body["looks"]) == 1
    assert body["applied_filters"] == {"occasion": "any", "style": "any", "vibe": "any", "weather": "any", "colors": "any"}
    assert body["used_fallback"] is False


def test_only_the_callers_own_items_are_ever_used(client, store):
    add_item(store, A, "shirt")
    add_item(store, A, "chinos")
    add_item(store, B, "dress")  # a one_piece alone is a valid look — B gets one too, but from B's own item
    a_body = client.post("/v1/outfit-suggestions", json={}, headers=as_user(A)).json()
    b_body = client.post("/v1/outfit-suggestions", json={}, headers=as_user(B)).json()
    a_ids = {i for look in a_body["looks"] for i in look["item_ids"]}
    b_ids = {i for look in b_body["looks"] for i in look["item_ids"]}
    assert a_ids and b_ids and not (a_ids & b_ids)


def test_empty_wardrobe_answers_200_with_no_looks_and_a_limitation(client, store):
    r = client.post("/v1/outfit-suggestions", json={}, headers=as_user(A))
    assert r.status_code == 200
    body = r.json()
    assert body["looks"] == [] and body["limitations"]


def test_invalid_filter_value_is_rejected(client, store):
    r = client.post("/v1/outfit-suggestions", json={"occasion": "space"}, headers=as_user(A))
    assert r.status_code == 422


def test_never_creates_a_job_or_touches_credits(client, store):
    add_item(store, A, "shirt")
    add_item(store, A, "chinos")
    before_jobs = dict(store.jobs)
    client.post("/v1/outfit-suggestions", json={}, headers=as_user(A))
    assert store.jobs == before_jobs  # no job was ever created
    assert A not in store.wallets or store.wallets.get(A, {}).get("balance") in (None, 0)


# --- Swap -------------------------------------------------------------------------------------------

def _look_body(top_id, bottom_id, target):
    return {"look": {"slots": {"top": top_id, "bottom": bottom_id}, "item_ids": [top_id, bottom_id]},
            "target_item_id": target}


def test_swap_options_returns_other_owned_items_in_the_same_slot(client, store):
    top = add_item(store, A, "shirt")
    bottom = add_item(store, A, "chinos")
    other_bottom = add_item(store, A, "jeans")
    r = client.post("/v1/outfit-suggestions/swap-options", json=_look_body(top["id"], bottom["id"], bottom["id"]),
                    headers=as_user(A))
    assert r.status_code == 200
    body = r.json()
    assert body["target_slot"] == "bottom"
    assert [a["item_id"] for a in body["alternatives"]] == [other_bottom["id"]]


def test_swap_options_rejects_another_accounts_item_as_stale(client, store):
    top = add_item(store, A, "shirt")
    bottom = add_item(store, A, "chinos")
    foreign = add_item(store, B, "jeans")
    r = client.post("/v1/outfit-suggestions/swap-options", json=_look_body(top["id"], bottom["id"], foreign["id"]),
                    headers=as_user(A))
    assert r.status_code == 409


def test_swap_options_rejects_a_deleted_item_as_stale(client, store):
    top = add_item(store, A, "shirt")
    bottom = add_item(store, A, "chinos")
    client.delete(f"/v1/items/{bottom['id']}", headers=as_user(A))
    r = client.post("/v1/outfit-suggestions/swap-options", json=_look_body(top["id"], bottom["id"], bottom["id"]),
                    headers=as_user(A))
    assert r.status_code == 409


def test_swap_options_with_no_alternative_is_an_empty_list(client, store):
    top = add_item(store, A, "shirt")
    bottom = add_item(store, A, "chinos")
    r = client.post("/v1/outfit-suggestions/swap-options", json=_look_body(top["id"], bottom["id"], bottom["id"]),
                    headers=as_user(A))
    assert r.status_code == 200 and r.json()["alternatives"] == []


def test_swap_options_needs_sign_in(client):
    assert client.post("/v1/outfit-suggestions/swap-options", json=_look_body("a", "b", "b")).status_code == 401


def test_prices_reports_whether_the_outfit_builder_is_on(store):
    client = v1_client(store)
    assert client.get("/v1/prices", headers=as_user(A)).json()["outfit_builder"] is True
