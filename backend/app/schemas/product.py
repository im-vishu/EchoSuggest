from datetime import datetime

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(default="", max_length=20000)
    category: str = Field(default="", max_length=200)
    tags: list[str] = Field(default_factory=list)
    price: float | None = Field(default=None, ge=0)
    sku: str | None = Field(default=None, max_length=120)


class ProductOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    tags: list[str]
    price: float | None
    sku: str | None
    created_at: datetime
