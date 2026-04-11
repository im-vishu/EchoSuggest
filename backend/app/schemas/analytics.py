from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AnalyticsTrackRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=256)
    product_id: str = Field(..., min_length=1, max_length=128)
    event_type: Literal["impression", "click"]
    source: Literal["hybrid", "collaborative", "content", "cold_start", "catalog"]


class AnalyticsTrackResponse(BaseModel):
    ok: bool = True


class SourceMetrics(BaseModel):
    source: str
    impressions: int
    clicks: int
    ctr: float = Field(..., description="Clicks / impressions in window")


class AnalyticsOverviewResponse(BaseModel):
    days: int
    since: datetime
    sources: list[SourceMetrics]
    total_impressions: int
    total_clicks: int
