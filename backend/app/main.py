import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.cache.redis_client import redis_close, redis_connect
from app.core.config import settings
from app.db import mongodb
from app.db.indexes import ensure_indexes
from app.services.jobs.precompute import run_precompute_job

log = logging.getLogger(__name__)


async def _precompute_scheduler() -> None:
    interval = settings.precompute_schedule_seconds
    await asyncio.sleep(interval)
    while True:
        try:
            await run_precompute_job(mongodb.get_db())
        except Exception:
            log.exception("Scheduled precompute failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await mongodb.connect()
    await ensure_indexes(mongodb.get_db())
    await redis_connect()
    schedule_task: asyncio.Task | None = None
    if settings.precompute_schedule_seconds > 0:
        schedule_task = asyncio.create_task(_precompute_scheduler())
        log.info(
            "Precompute scheduler enabled (every %s s)",
            settings.precompute_schedule_seconds,
        )
    yield
    if schedule_task is not None:
        schedule_task.cancel()
        try:
            await schedule_task
        except asyncio.CancelledError:
            pass
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
