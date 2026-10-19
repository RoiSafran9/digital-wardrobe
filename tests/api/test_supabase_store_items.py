"""SupabaseStore item listing must work on a database without the outfit migration (no review_state column)."""
import httpx
from api.auth import Settings
from api.store import SupabaseStore


def store_returning(rows, seen):
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=rows)
    client = httpx.Client(base_url="https://sb.test", transport=httpx.MockTransport(handler))
    return SupabaseStore(Settings(auth_on=True, supabase_url="https://sb.test", secret_key="k"), client=client)


def test_the_closet_query_never_names_review_state_and_hides_pending_results():
    seen = []
    rows = [{"id": "old"},  # a row from before the migration: no review_state at all
            {"id": "kept", "review_state": "kept"}, {"id": "pending", "review_state": "pending"}]
    items = store_returning(rows, seen).list_items("u1")
    assert [i["id"] for i in items] == ["old", "kept"]
    assert not any("review_state" in key or "review_state" in value for key, value in seen[0].items())
