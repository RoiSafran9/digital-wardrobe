"""A v1 API wired to an in-memory store, where "Bearer <user id>" signs you in as that user."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from api.auth import User, add_error_handlers, current_user
from api.logs import add_request_log
from api.routes.v1 import router
from api.store import MemoryStore, get_store

A, B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def fake_user(request: Request) -> User:
    scheme, _, user = request.headers.get("Authorization", "").partition(" ")
    if scheme != "Bearer" or not user:
        raise HTTPException(401, "sign in again")
    request.state.user_id = user
    return User(id=user, email=f"{user}@test.dev")


def v1_client(store: MemoryStore, on_response=None) -> TestClient:
    app = FastAPI()
    add_error_handlers(app)
    add_request_log(app, on_response)
    app.include_router(router)
    app.dependency_overrides[current_user] = fake_user
    app.dependency_overrides[get_store] = lambda: store
    return TestClient(app)


def as_user(user: str, key: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {user}"}
    if key:
        headers["Idempotency-Key"] = key
    return headers


PHOTO = ("photo.jpg", b"\xff\xd8\xff fake jpeg", "image/jpeg")
