from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database, require_admin
from app.cache.redis_client import cache_get, get_redis
from app.schemas.jobs import JobStatusResponse, PrecomputeResponse
from app.services.jobs.precompute import run_precompute_job

router = APIRouter(prefix="/jobs", tags=["jobs"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


@router.post(
    "/precompute",
    response_model=PrecomputeResponse,
    dependencies=[Depends(require_admin)],
)
async def trigger_precompute(
    background_tasks: BackgroundTasks,
    db: Db,
) -> PrecomputeResponse:
    background_tasks.add_task(run_precompute_job, db)
    return PrecomputeResponse(
        ok=True,
        message="Precompute job scheduled (collaborative warm + trending snapshots)",
    )


@router.get("/status", response_model=JobStatusResponse)
async def job_status() -> JobStatusResponse:
    raw = await cache_get("precompute:v1:last_run")
    last_at: datetime | None = None
    if raw:
        try:
            last_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            last_at = None

    keys: list[str] = []
    client = get_redis()
    if client is not None:
        async for key in client.scan_iter(match="precompute:*"):
            keys.append(key)
            if len(keys) >= 30:
                break
        keys = sorted(keys)

    return JobStatusResponse(last_precompute_at=last_at, redis_precompute_keys=keys)
