import re
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
    q: str | None = Query(
        None,
        max_length=200,
        description="Case-insensitive search in title and description",
    ),
    category: str | None = Query(None, max_length=200),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    tag: str | None = Query(None, max_length=120, description="Match if tag appears in tags[]"),
) -> list[ProductOut]:
    if (
        min_price is not None
        and max_price is not None
        and min_price > max_price
    ):
        raise HTTPException(
            status_code=400,
            detail="min_price cannot be greater than max_price",
        )
    conds: list[dict] = []
    if q and q.strip():
        esc = re.escape(q.strip())
        conds.append(
            {
                "$or": [
                    {"title": {"$regex": esc, "$options": "i"}},
                    {"description": {"$regex": esc, "$options": "i"}},
                ]
            }
        )
    if category and category.strip():
        esc = re.escape(category.strip())
        conds.append({"category": {"$regex": f"^{esc}$", "$options": "i"}})
    if tag and tag.strip():
        conds.append({"tags": tag.strip()})
    if min_price is not None or max_price is not None:
        prange: dict = {}
        if min_price is not None:
            prange["$gte"] = min_price
        if max_price is not None:
            prange["$lte"] = max_price
        conds.append({"price": prange})
    if not conds:
        match: dict = {}
    elif len(conds) == 1:
        match = conds[0]
    else:
        match = {"$and": conds}
    cursor = db.products.find(match).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return [_doc_to_out(d) for d in items]


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: Db) -> ProductOut:
    doc = await db.products.find_one({"_id": product_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return _doc_to_out(doc)
