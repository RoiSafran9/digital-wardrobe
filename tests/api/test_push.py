"""'Notify when ready': the app registers its push token; the worker tells the owner when a job finishes."""
import pytest
from api import push
from api.store import MemoryStore
from api.worker import run_once
from tests.api.v1_helpers import A, B, as_user, v1_client
from tests.api.test_worker import factory, garment_job

TOKEN = "ExponentPushToken[abc123]"


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


@pytest.fixture
def sent(monkeypatch):
    messages = []
    monkeypatch.setattr(push, "BACKGROUND", False)
    monkeypatch.setattr(push, "send", lambda batch: messages.extend(batch))
    return messages


def test_a_token_registers_for_the_signed_in_user_only(client, store):
    assert client.post("/v1/push-token", json={"token": TOKEN}, headers=as_user(A)).status_code == 204
    assert client.post("/v1/push-token", json={"token": TOKEN}, headers=as_user(A)).status_code == 204  # idempotent
    assert store.push_tokens(A) == [TOKEN] and store.push_tokens(B) == []
    assert client.request("DELETE", "/v1/push-token", json={"token": TOKEN}, headers=as_user(A)).status_code == 204
    assert store.push_tokens(A) == []


@pytest.mark.parametrize("token", ["", "hello", "x" * 300])
def test_only_expo_push_tokens_are_accepted(client, token):
    assert client.post("/v1/push-token", json={"token": token}, headers=as_user(A)).status_code == 400


def test_push_token_needs_sign_in(client):
    assert client.post("/v1/push-token", json={"token": TOKEN}).status_code == 401


async def test_a_finished_garment_job_notifies_its_owner(store, sent):
    store.add_push_token(A, TOKEN)
    store.add_push_token(B, "ExponentPushToken[someone-else]")
    garment_job(store)
    await run_once(store, factory())
    assert len(sent) == 1
    assert sent[0]["to"] == TOKEN and sent[0]["title"] == "Your pieces are ready"
    assert "2 new pieces" in sent[0]["body"]


async def test_no_token_no_push_and_a_failing_push_never_fails_the_job(store, monkeypatch):
    job_id = garment_job(store)
    def boom(batch):
        raise RuntimeError("push service down")
    monkeypatch.setattr(push, "BACKGROUND", False)
    monkeypatch.setattr(push, "send", boom)
    store.add_push_token(A, TOKEN)
    await run_once(store, factory())
    assert store.jobs[job_id]["status"] == "succeeded"
