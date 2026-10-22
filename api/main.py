import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from api.auth import Settings, add_error_handlers, get_settings, load_settings
from api.routes.images import router as images_router
from api.routes.items import router as items_router
from api.routes.runs import default_provider_factory, router as runs_router
from api.routes.turn import router as turn_router


def create_app(settings: Settings | None = None, start_worker: bool = True) -> FastAPI:
    settings = settings or load_settings()
    if not settings.auth_on:
        # Single-owner local mode (default): today's file-based API, unchanged.
        app = FastAPI()
        for router in (images_router, items_router, runs_router, turn_router):
            app.include_router(router)
        app.get("/healthz")(lambda: {"status": "ok", "mode": "local"})
        return app

    # Multi-user mode: only the token-checked v1 API; the local runs/ routes are not mounted at all.
    from api.credits import NoCharge, WalletGate, get_gate, get_prices, load_prices
    from api.routes.v1 import router as v1_router
    from api.routes.health import router as health_router
    from api.store import SupabaseStore, get_store
    from api.worker import run_forever

    import os
    from api.logs import add_request_log, configure_logging
    log_dir = os.environ.get("WARDROBE_LOG_DIR", "logs")
    configure_logging(None if log_dir == "off" else log_dir)

    store = SupabaseStore(settings)
    # Billing is off unless WARDROBE_BILLING=on (then every action must be priced, or startup stops here).
    prices = load_prices()
    gate = WalletGate(store) if prices else NoCharge()

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(run_forever(store, default_provider_factory, gate=gate)) if start_worker else None
        yield
        if task:
            task.cancel()

    app = FastAPI(lifespan=lifespan)
    add_error_handlers(app)
    add_request_log(app)
    app.include_router(v1_router)
    app.include_router(health_router)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_prices] = lambda: prices
    app.dependency_overrides[get_gate] = lambda: gate
    return app


app = create_app()
