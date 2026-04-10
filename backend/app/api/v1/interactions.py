from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.schemas.interaction import InteractionCreate, InteractionOut

router = APIRouter(prefix="/interactions", tags=["interactions"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


def _doc_to_out(doc: dict) -> InteractionOut:
    return InteractionOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        product_id=doc["product_id"],
        event_type=doc["event_type"],
        rating=doc.get("rating"),
        created_at=doc["created_at"],
    )


@router.post("", response_model=InteractionOut, status_code=status.HTTP_201_CREATED)
async def create_interaction(body: InteractionCreate, db: Db) -> InteractionOut:
    product = await db.products.find_one({"_id": body.product_id})
    if not product:
        raise HTTPException(status_code=400, detail="Unknown product_id")
    now = datetime.now(timezone.utc)
    doc = {
        "_id": str(uuid4()),
        **body.model_dump(),
        "created_at": now,
    }
    await db.interactions.insert_one(doc)
    return _doc_to_out(doc)


@router.get("", response_model=list[InteractionOut])
async def list_interactions(
    db: Db,
    user_id: str | None = None,
    product_id: str | None = None,
    skip: int = Query(0, ge=0, le=100_000),
    limit: int = Query(100, ge=1, le=500),
) -> list[InteractionOut]:
    filt: dict = {}
    if user_id:
        filt["user_id"] = user_id
    if product_id:
        filt["product_id"] = product_id
    cursor = db.interactions.find(filt).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return [_doc_to_out(d) for d in items]
