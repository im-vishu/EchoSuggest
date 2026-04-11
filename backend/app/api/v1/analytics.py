from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsTrackRequest,
    AnalyticsTrackResponse,
)
from app.services.analytics.overview import analytics_overview

router = APIRouter(prefix="/analytics", tags=["analytics"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


@router.post("/track", response_model=AnalyticsTrackResponse)
async def track_event(body: AnalyticsTrackRequest, db: Db) -> AnalyticsTrackResponse:
    doc = {
        "_id": str(uuid4()),
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.analytics_events.insert_one(doc)
    return AnalyticsTrackResponse()


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_overview(
    db: Db,
    days: int = Query(7, ge=1, le=90),
) -> AnalyticsOverviewResponse:
    return await analytics_overview(db, days=days)
