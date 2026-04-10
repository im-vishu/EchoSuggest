from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class InteractionCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=256)
    product_id: str = Field(..., min_length=1, max_length=128)
    event_type: Literal["click", "view", "purchase", "rating"]
    rating: float | None = Field(default=None, ge=1.0, le=5.0)

    @model_validator(mode="after")
    def rating_only_for_rating_events(self) -> "InteractionCreate":
        if self.event_type == "rating" and self.rating is None:
            raise ValueError("rating is required when event_type is 'rating'")
        if self.event_type != "rating" and self.rating is not None:
            raise ValueError("rating must be omitted unless event_type is 'rating'")
        return self


class InteractionOut(BaseModel):
    id: str
    user_id: str
    product_id: str
    event_type: str
    rating: float | None
    created_at: datetime
