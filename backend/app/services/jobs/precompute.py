"""Warm collaborative cache and store cold-start snapshots in Redis."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.cache.redis_client import cache_set, get_redis
from app.core.config import settings
from app.services.recommendations.cold_start import cold_start_recommend
from app.services.recommendations.collaborative import load_or_fit_collaborative


async def run_precompute_job(db: AsyncIOMotorDatabase) -> dict[str, str]:
    """Load CF model (fills in-process cache) and persist trending lists to Redis."""
    await load_or_fit_collaborative(db)
    now = datetime.now(timezone.utc).isoformat()
    out: dict[str, str] = {"last_run": now}

    client = get_redis()
    ttl = settings.precompute_ttl_seconds

    for window in (7, 30):
        rows = await cold_start_recommend(
            db, top_k=50, mode="trending", window_days=window
        )
        key = f"precompute:v1:trending:w{window}"
        payload = json.dumps({"computed_at": now, "items": rows})
        await cache_set(key, payload, ttl_seconds=ttl)
        out[key] = "ok" if client else "skipped_no_redis"

    await cache_set("precompute:v1:last_run", now, ttl_seconds=86400 * 7)
    return out
