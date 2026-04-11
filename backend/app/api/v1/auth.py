from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.user import TokenResponse, UserLogin, UserRegister
from app.services.users import authenticate_user, create_user, user_doc_to_public

router = APIRouter(prefix="/auth", tags=["auth"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: Db) -> TokenResponse:
    user = await create_user(db, body)
    token = create_access_token(subject=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_access_expire_minutes * 60,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: Db) -> TokenResponse:
    doc = await authenticate_user(db, str(body.email), body.password)
    if doc is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = user_doc_to_public(doc)
    token = create_access_token(subject=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_access_expire_minutes * 60,
        user=user,
    )
