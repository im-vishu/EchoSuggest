import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.cache.redis_client import cache_get, cache_set
from app.core.config import settings
from app.schemas.recommendation import (
    CollaborativeItem,
    CollaborativeRecommendationResponse,
    ContentRecommendationResponse,
    HybridItem,
    HybridRecommendationResponse,
    SimilarItem,
)
from app.services.recommendations.collaborative import (
    load_or_fit_collaborative,
    recommend_for_user,
)
from app.services.recommendations.content import ContentRecommender
from app.services.recommendations.hybrid import hybrid_recommend

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]

_MAX_PRODUCTS_CONTENT = 10_000


@router.get("/content/{product_id}", response_model=ContentRecommendationResponse)
async def content_similar(
    product_id: str,
    db: Db,
    top_k: int = Query(10, ge=1, le=50),
) -> ContentRecommendationResponse:
    exists = await db.products.find_one({"_id": product_id}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Product not found")

    cursor = db.products.find({})
    products = await cursor.to_list(length=_MAX_PRODUCTS_CONTENT)
    if len(products) < 2:
        return ContentRecommendationResponse(source_product_id=product_id, items=[])

    recommender = ContentRecommender()

    def _fit() -> None:
        recommender.fit(products)

    await asyncio.to_thread(_fit)
    pairs = recommender.similar(product_id, top_k=top_k)
    items = [SimilarItem(product_id=pid, score=score) for pid, score in pairs]
    return ContentRecommendationResponse(source_product_id=product_id, items=items)


@router.get(
    "/collaborative/{user_id}",
    response_model=CollaborativeRecommendationResponse,
)
async def collaborative_for_user(
    user_id: str,
    db: Db,
    top_k: int = Query(10, ge=1, le=50),
) -> CollaborativeRecommendationResponse:
    model, raw_user_items, catalog_ids = await load_or_fit_collaborative(db)
    if model is None:
        return CollaborativeRecommendationResponse(user_id=user_id, items=[])

    history = raw_user_items.get(user_id, set())
    candidates = catalog_ids if catalog_ids else list(
        {i for items in raw_user_items.values() for i in items}
    )
    pairs = recommend_for_user(model, user_id, top_k, candidates, history)
    items = [
        CollaborativeItem(product_id=pid, estimated_rating=est) for pid, est in pairs
    ]
    return CollaborativeRecommendationResponse(user_id=user_id, items=items)


@router.get("/hybrid/{user_id}", response_model=HybridRecommendationResponse)
async def hybrid_for_user(
    user_id: str,
    db: Db,
    top_k: int = Query(10, ge=1, le=50),
    w_collaborative: float = Query(0.6, ge=0.0, le=1.0),
    w_content: float = Query(0.4, ge=0.0, le=1.0),
    max_pool: int = Query(200, ge=50, le=500),
) -> HybridRecommendationResponse:
    interaction_n = await db.interactions.count_documents({})
    product_n = await db.products.count_documents({})
    cache_key = (
        f"hybrid:v1:{interaction_n}:{product_n}:{user_id}:"
        f"{top_k}:{w_collaborative:.6f}:{w_content:.6f}:{max_pool}"
    )
    cached = await cache_get(cache_key)
    if cached:
        return HybridRecommendationResponse.model_validate_json(cached)

    rows, nw_cf, nw_ct = await hybrid_recommend(
        db,
        user_id,
        top_k,
        w_collaborative,
        w_content,
        max_pool=max_pool,
    )
    resp = HybridRecommendationResponse(
        user_id=user_id,
        weight_collaborative=nw_cf,
        weight_content=nw_ct,
        items=[HybridItem(**r) for r in rows],
    )
    await cache_set(
        cache_key,
        resp.model_dump_json(),
        settings.recommend_cache_ttl_seconds,
    )
    return resp
