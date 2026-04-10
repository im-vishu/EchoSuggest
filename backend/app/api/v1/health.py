from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/db/ping")
async def db_ping(db: AsyncIOMotorDatabase = Depends(get_database)) -> dict[str, str]:
    await db.command("ping")
    return {"mongodb": "ok"}
