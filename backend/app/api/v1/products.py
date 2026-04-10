from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.schemas.product import ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


def _doc_to_out(doc: dict) -> ProductOut:
    return ProductOut(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc.get("description", ""),
        category=doc.get("category", ""),
        tags=list(doc.get("tags") or []),
        price=doc.get("price"),
        sku=doc.get("sku"),
        created_at=doc["created_at"],
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: Db) -> ProductOut:
    now = datetime.now(timezone.utc)
    doc = {
        "_id": str(uuid4()),
        **body.model_dump(),
        "created_at": now,
    }
    await db.products.insert_one(doc)
    return _doc_to_out(doc)


@router.post("/bulk", response_model=list[ProductOut], status_code=status.HTTP_201_CREATED)
async def create_products_bulk(body: list[ProductCreate], db: Db) -> list[ProductOut]:
    if len(body) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 products per bulk request")
    now = datetime.now(timezone.utc)
    docs = [
        {
            "_id": str(uuid4()),
            **item.model_dump(),
            "created_at": now,
        }
        for item in body
    ]
    if docs:
        await db.products.insert_many(docs)
    return [_doc_to_out(d) for d in docs]


@router.get("", response_model=list[ProductOut])
async def list_products(
    db: Db,
    skip: int = Query(0, ge=0, le=100_000),
    limit: int = Query(50, ge=1, le=200),
) -> list[ProductOut]:
    cursor = db.products.find({}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return [_doc_to_out(d) for d in items]


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: Db) -> ProductOut:
    doc = await db.products.find_one({"_id": product_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return _doc_to_out(doc)
