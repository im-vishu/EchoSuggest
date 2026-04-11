from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.security import hash_password, verify_password
from app.schemas.user import UserProfileUpdate, UserPublic, UserRegister


def user_doc_to_public(doc: dict[str, Any]) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        email=doc["email"],
        display_name=doc.get("display_name"),
        preferences=doc.get("preferences") or {},
        created_at=doc["created_at"],
    )


async def create_user(db: AsyncIOMotorDatabase, body: UserRegister) -> UserPublic:
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    now = datetime.now(timezone.utc)
    display = (body.display_name or "").strip() or None
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "display_name": display,
        "preferences": {},
        "created_at": now,
        "updated_at": now,
    }
    try:
        res = await db.users.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Email already registered") from exc
    doc["_id"] = res.inserted_id
    return user_doc_to_public(doc)


async def get_user_by_id(
    db: AsyncIOMotorDatabase, user_id: str
) -> dict[str, Any] | None:
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None
    return await db.users.find_one({"_id": oid})


async def authenticate_user(
    db: AsyncIOMotorDatabase, email: str, password: str
) -> dict[str, Any] | None:
    doc = await db.users.find_one({"email": email.lower().strip()})
    if not doc:
        return None
    if not verify_password(password, doc["password_hash"]):
        return None
    return doc


async def update_user_profile(
    db: AsyncIOMotorDatabase, user_id: str, patch: UserProfileUpdate
) -> UserPublic | None:
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None
    updates: dict[str, Any] = {}
    if patch.display_name is not None:
        d = patch.display_name.strip()
        updates["display_name"] = d if d else None
    if patch.preferences is not None:
        updates["preferences"] = patch.preferences
    if not updates:
        doc = await db.users.find_one({"_id": oid})
        return user_doc_to_public(doc) if doc else None
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": oid}, {"$set": updates})
    doc = await db.users.find_one({"_id": oid})
    return user_doc_to_public(doc) if doc else None
