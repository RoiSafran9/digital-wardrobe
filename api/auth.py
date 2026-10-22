"""Who is calling: Supabase access tokens verified against the project's public signing keys.

Off by default (WARDROBE_AUTH unset): the single-owner local API keeps working without accounts.
"""
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Mapping
import jwt
from fastapi import Depends, HTTPException, Request


@dataclass(frozen=True)
class Settings:
    auth_on: bool
    supabase_url: str = ""
    secret_key: str = ""
    public_url: str = ""
    issuer: str = ""


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    if env.get("WARDROBE_AUTH", "off").lower() not in ("on", "1", "true"):
        return Settings(auth_on=False)
    url = env.get("SUPABASE_URL", "").strip().rstrip("/")
    secret = env.get("SUPABASE_SECRET_KEY", "").strip()
    for name, value in (("SUPABASE_URL", url), ("SUPABASE_SECRET_KEY", secret)):
        if not value:
            raise RuntimeError(f"WARDROBE_AUTH is on but {name} is not set")
    return Settings(
        auth_on=True, supabase_url=url, secret_key=secret,
        public_url=env.get("SUPABASE_PUBLIC_URL", "").strip().rstrip("/") or url,
        issuer=env.get("SUPABASE_JWT_ISSUER", "").strip() or f"{url}/auth/v1",
    )


@dataclass(frozen=True)
class User:
    id: str
    email: str | None


class InvalidToken(Exception):
    pass


class TokenVerifier:
    # Only asymmetric keys: verifying with the legacy shared secret is what Supabase advises against.
    ALGORITHMS = ["ES256", "RS256"]

    def __init__(self, jwks_url: str, issuer: str, jwk_client=None):
        self.issuer = issuer
        self.jwk_client = jwk_client or jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=600)

    def verify(self, token: str) -> User:
        try:
            key = self.jwk_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=self.ALGORITHMS, audience="authenticated",
                                issuer=self.issuer, options={"require": ["exp", "sub", "aud", "iss"]})
        except (jwt.PyJWTError, ValueError) as e:
            raise InvalidToken(str(e)) from e
        if not claims.get("sub"):
            raise InvalidToken("token has no subject")
        return User(id=claims["sub"], email=claims.get("email"))


@lru_cache
def get_settings() -> Settings:
    return load_settings()


@lru_cache
def _verifier(jwks_url: str, issuer: str) -> TokenVerifier:
    return TokenVerifier(jwks_url, issuer)


def get_verifier(settings: Settings = Depends(get_settings)) -> TokenVerifier:
    return _verifier(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", settings.issuer)


UNAUTHORIZED = HTTPException(status_code=401, detail="sign in again")


def current_user(request: Request, verifier: TokenVerifier = Depends(get_verifier)) -> User:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise UNAUTHORIZED
    try:
        user = verifier.verify(token.strip())
    except InvalidToken:
        raise UNAUTHORIZED
    request.state.user_id = user.id  # for the request log and refusal events (api/logs.py)
    return user


def add_error_handlers(app) -> None:
    """Errors keep the API's {"error": "..."} shape the app already reads."""
    from fastapi.responses import JSONResponse

    @app.exception_handler(HTTPException)
    async def _http_error(_request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
