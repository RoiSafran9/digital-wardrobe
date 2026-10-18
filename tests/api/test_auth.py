import time
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from api.auth import InvalidToken, TokenVerifier, User, add_error_handlers, current_user, get_verifier, load_settings

ISSUER = "http://127.0.0.1:54321/auth/v1"
KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJwkClient:
    """Stands in for PyJWKClient: knows one key id."""
    def get_signing_key_from_jwt(self, token):
        kid = jwt.get_unverified_header(token).get("kid")
        if kid != "k1":
            raise jwt.PyJWKClientError("unknown kid")
        return type("Key", (), {"key": KEY.public_key()})()


def token(**overrides):
    claims = {"sub": "user-a", "email": "a@test.dev", "aud": "authenticated", "iss": ISSUER,
              "exp": int(time.time()) + 600, "role": "authenticated"}
    key, alg, kid = overrides.pop("_key", KEY), overrides.pop("_alg", "ES256"), overrides.pop("_kid", "k1")
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm=alg, headers={"kid": kid})


verifier = TokenVerifier("http://unused/jwks", ISSUER, jwk_client=FakeJwkClient())


def test_valid_token_gives_the_user():
    assert verifier.verify(token()) == User(id="user-a", email="a@test.dev")


@pytest.mark.parametrize("bad", [
    token(exp=int(time.time()) - 10),                         # expired
    token(aud="anon"),                                        # wrong audience
    token(iss="https://evil.example/auth/v1"),                # wrong issuer
    token(_kid="other"),                                      # unknown key id
    token(_key=OTHER_KEY),                                    # signed by someone else
    jwt.encode({"sub": "user-a", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 600},
               "a-shared-secret-that-is-long-enough!!", algorithm="HS256", headers={"kid": "k1"}),  # legacy HS256
    token(sub=""),                                            # no subject
    "not.a.jwt",
    "",
])
def test_bad_tokens_are_rejected(bad):
    with pytest.raises(InvalidToken):
        verifier.verify(bad)


def _app():
    app = FastAPI()
    add_error_handlers(app)

    @app.get("/me")
    def me(user: User = Depends(current_user)):
        return {"id": user.id}

    app.dependency_overrides[get_verifier] = lambda: verifier
    return TestClient(app)


@pytest.mark.parametrize("header", [None, "", "Bearer", "Bearer ", "Basic abc", f"Bearer {token(aud='anon')}"])
def test_requests_without_a_valid_token_get_401_and_no_details(header):
    headers = {"Authorization": header} if header is not None else {}
    response = _app().get("/me", headers=headers)
    assert response.status_code == 401
    assert response.json() == {"error": "sign in again"}


def test_requests_with_a_valid_token_reach_the_route():
    response = _app().get("/me", headers={"Authorization": f"Bearer {token()}"})
    assert response.json() == {"id": "user-a"}


def test_settings_default_to_local_mode():
    assert load_settings({}).auth_on is False


def test_auth_on_requires_url_and_secret():
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        load_settings({"WARDROBE_AUTH": "on", "SUPABASE_SECRET_KEY": "s"})
    with pytest.raises(RuntimeError, match="SUPABASE_SECRET_KEY"):
        load_settings({"WARDROBE_AUTH": "on", "SUPABASE_URL": "http://127.0.0.1:54321"})


def test_public_url_and_issuer_derive_from_the_url():
    s = load_settings({"WARDROBE_AUTH": "on", "SUPABASE_URL": "http://127.0.0.1:54321/", "SUPABASE_SECRET_KEY": "s"})
    assert (s.supabase_url, s.public_url, s.issuer) == ("http://127.0.0.1:54321", "http://127.0.0.1:54321", ISSUER)
    s = load_settings({"WARDROBE_AUTH": "on", "SUPABASE_URL": "http://127.0.0.1:54321", "SUPABASE_SECRET_KEY": "s",
                       "SUPABASE_PUBLIC_URL": "http://192.168.1.20:54321", "SUPABASE_JWT_ISSUER": "https://x/auth/v1"})
    assert (s.public_url, s.issuer) == ("http://192.168.1.20:54321", "https://x/auth/v1")
