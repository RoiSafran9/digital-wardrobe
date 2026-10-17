from fastapi import FastAPI
from api.routes.images import router as images_router
from api.routes.items import router as items_router
from api.routes.runs import router as runs_router
from api.routes.turn import router as turn_router

app = FastAPI()
app.include_router(images_router)
app.include_router(items_router)
app.include_router(runs_router)
app.include_router(turn_router)
