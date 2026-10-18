import os
from dotenv import load_dotenv

load_dotenv(override=True)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"missing env var: {name}")
    return value
