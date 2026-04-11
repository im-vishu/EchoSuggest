from datetime import datetime

from pydantic import BaseModel, Field


class PrecomputeResponse(BaseModel):
    ok: bool = True
    message: str = "precompute scheduled"


class JobStatusResponse(BaseModel):
    last_precompute_at: datetime | None = None
    redis_precompute_keys: list[str] = Field(default_factory=list)
