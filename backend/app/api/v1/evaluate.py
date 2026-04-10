from typing import Annotated

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.schemas.recommendation import PrecisionAtKReport
from app.services.evaluation.holdout import run_collaborative_precision_holdout

router = APIRouter(prefix="/evaluate", tags=["evaluate"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


@router.get("/precision-at-k", response_model=PrecisionAtKReport)
async def collaborative_precision_at_k(
    db: Db,
    k: int = Query(10, ge=1, le=50),
    max_users: int = Query(100, ge=5, le=5_000),
) -> PrecisionAtKReport:
    """
    Offline **collaborative** Precision@K using a per-user last-event holdout.
    Can be slow on large logs; lower `max_users` for quick checks.
    """
    result = await run_collaborative_precision_holdout(db, k=k, max_users=max_users)
    return PrecisionAtKReport(**result)
