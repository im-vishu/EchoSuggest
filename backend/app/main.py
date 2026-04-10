from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.cache.redis_client import redis_close, redis_connect
from app.core.config import settings
from app.db import mongodb
from app.db.indexes import ensure_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    await mongodb.connect()
    await ensure_indexes(mongodb.get_db())
    await redis_connect()
    yield
    await redis_close()
    mongodb.close()


app = FastAPI(
    title="EchoSuggest API",
    description="AI-powered product recommendation engine",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "echosuggest", "docs": "/docs"}
