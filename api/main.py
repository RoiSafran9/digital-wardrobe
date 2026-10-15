from fastapi import FastAPI
from api.routes.images import router as images_router
from api.routes.items import router as items_router

app = FastAPI()
app.include_router(images_router)
app.include_router(items_router)
