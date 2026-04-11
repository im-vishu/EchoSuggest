from typing import Annotated

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from pydantic import BaseModel, Field

from app.api.deps import get_database
from app.cache.redis_client import get_redis
from app.services.analytics.overview import analytics_overview

router = APIRouter(prefix="/metrics", tags=["metrics"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


class MetricsSummaryResponse(BaseModel):
    redis_connected: bool
    analytics_window_days: int
    total_impressions: int
    total_clicks: int
    overall_ctr: float = Field(..., description="Total clicks / total impressions")


@router.get("/summary", response_model=MetricsSummaryResponse)
async def metrics_summary(
    db: Db,
    days: int = Query(7, ge=1, le=90),
) -> MetricsSummaryResponse:
    ov = await analytics_overview(db, days=days)
    imp = ov.total_impressions
    clk = ov.total_clicks
    ctr = clk / imp if imp else 0.0
    return MetricsSummaryResponse(
        redis_connected=get_redis() is not None,
        analytics_window_days=days,
        total_impressions=imp,
        total_clicks=clk,
        overall_ctr=round(ctr, 4),
    )
