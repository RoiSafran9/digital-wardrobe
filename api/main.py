from fastapi import FastAPI
from api.routes.images import router as images_router

app = FastAPI()
app.include_router(images_router)
