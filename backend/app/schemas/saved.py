from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.product import ProductOut


class SavedProductBody(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=128)


class SavedItemOut(BaseModel):
    product_id: str
    created_at: datetime


class SavedListResponse(BaseModel):
    items: list[SavedItemOut]
    products: list[ProductOut] = Field(
        default_factory=list,
        description="Populated when expand=true, same order as items",
    )
