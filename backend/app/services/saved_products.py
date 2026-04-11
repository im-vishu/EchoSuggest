from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase


async def add_saved(
    db: AsyncIOMotorDatabase,
    user_oid: ObjectId,
    product_id: str,
) -> dict[str, Any]:
    exists = await db.products.find_one({"_id": product_id}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Product not found")
    now = datetime.now(timezone.utc)
    await db.user_saved_products.insert_one(
        {
            "user_id": user_oid,
            "product_id": product_id,
            "created_at": now,
        }
    )
    return {
        "user_id": user_oid,
        "product_id": product_id,
        "created_at": now,
    }


async def remove_saved(
    db: AsyncIOMotorDatabase,
    user_oid: ObjectId,
    product_id: str,
) -> bool:
    res = await db.user_saved_products.delete_one(
        {"user_id": user_oid, "product_id": product_id}
    )
    return res.deleted_count > 0


async def list_saved(
    db: AsyncIOMotorDatabase,
    user_oid: ObjectId,
    *,
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    cursor = (
        db.user_saved_products.find({"user_id": user_oid})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


def parse_user_oid(user: dict[str, Any]) -> ObjectId:
    raw = user.get("_id")
    if isinstance(raw, ObjectId):
        return raw
    try:
        return ObjectId(str(raw))
    except (InvalidId, TypeError) as e:
        raise HTTPException(status_code=401, detail="Invalid user") from e
