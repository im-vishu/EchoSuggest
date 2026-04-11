from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import CurrentUser, get_database
from app.schemas.user import UserProfileUpdate, UserPublic
from app.services.users import update_user_profile, user_doc_to_public

router = APIRouter(prefix="/users", tags=["users"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


@router.get("/me", response_model=UserPublic)
async def read_me(user: CurrentUser) -> UserPublic:
    return user_doc_to_public(user)


@router.patch("/me", response_model=UserPublic)
async def patch_me(
    body: UserProfileUpdate,
    user: CurrentUser,
    db: Db,
) -> UserPublic:
    uid = str(user["_id"])
    out = await update_user_profile(db, uid, body)
    if out is None:
        raise HTTPException(status_code=404, detail="User not found")
    return out
