import asyncio
import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.cache.redis_client import cache_get, cache_set
from app.core.config import settings
from app.schemas.recommendation import (
    ColdStartItem,
    ColdStartRecommendationResponse,
    CollaborativeItem,
    CollaborativeRecommendationResponse,
    ContentRecommendationResponse,
    HybridBatchRequest,
    HybridBatchResponse,
    HybridItem,
    HybridRecommendationResponse,
    SimilarItem,
)
from app.services.recommendations.cold_start import cold_start_recommend
from app.services.recommendations.collaborative import (
    load_or_fit_collaborative,
    recommend_for_user,
)
from app.services.recommendations.content import ContentRecommender
from app.services.recommendations.hybrid import hybrid_recommend, hybrid_recommend_batch

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

    product_n = await db.products.count_documents({})
    cache_key = f"content:v1:{product_n}:{product_id}:{top_k}"
    cached = await cache_get(cache_key)
    if cached:
        return ContentRecommendationResponse.model_validate_json(cached)

    cursor = db.products.find({})
    products = await cursor.to_list(length=_MAX_PRODUCTS_CONTENT)
    if len(products) < 2:
        resp = ContentRecommendationResponse(source_product_id=product_id, items=[])
        await cache_set(
            cache_key,
            resp.model_dump_json(),
            settings.recommend_cache_ttl_seconds,
        )
        return resp

    recommender = ContentRecommender()

    def _fit() -> None:
        recommender.fit(products)

    await asyncio.to_thread(_fit)
    pairs = recommender.similar(product_id, top_k=top_k)
    items = [SimilarItem(product_id=pid, score=score) for pid, score in pairs]
    resp = ContentRecommendationResponse(source_product_id=product_id, items=items)
    await cache_set(
        cache_key,
        resp.model_dump_json(),
        settings.recommend_cache_ttl_seconds,
    )
    return resp


@router.get(
    "/collaborative/{user_id}",
    response_model=CollaborativeRecommendationResponse,
)
async def collaborative_for_user(
    user_id: str,
    db: Db,
    top_k: int = Query(10, ge=1, le=50),
) -> CollaborativeRecommendationResponse:
    interaction_n = await db.interactions.count_documents({})
    product_n = await db.products.count_documents({})
    cache_key = f"cf:v1:{interaction_n}:{product_n}:{user_id}:{top_k}"
    cached = await cache_get(cache_key)
    if cached:
        return CollaborativeRecommendationResponse.model_validate_json(cached)

    model, raw_user_items, catalog_ids = await load_or_fit_collaborative(db)
    if model is None:
        resp = CollaborativeRecommendationResponse(user_id=user_id, items=[])
        await cache_set(
            cache_key,
            resp.model_dump_json(),
            settings.recommend_cache_ttl_seconds,
        )
        return resp

    history = raw_user_items.get(user_id, set())
    candidates = catalog_ids if catalog_ids else list(
        {i for items in raw_user_items.values() for i in items}
    )
    pairs = recommend_for_user(model, user_id, top_k, candidates, history)
    items = [
        CollaborativeItem(product_id=pid, estimated_rating=est) for pid, est in pairs
    ]
    resp = CollaborativeRecommendationResponse(user_id=user_id, items=items)
    await cache_set(
        cache_key,
        resp.model_dump_json(),
        settings.recommend_cache_ttl_seconds,
    )
    return resp


@router.get("/cold-start", response_model=ColdStartRecommendationResponse)
async def cold_start(
    db: Db,
    top_k: int = Query(10, ge=1, le=50),
    mode: Literal["popular", "trending"] = Query("trending"),
    window_days: int = Query(30, ge=1, le=180),
    category: str | None = Query(
        None,
        description="Optional category filter (exact match, case-insensitive)",
    ),
) -> ColdStartRecommendationResponse:
    if (
        mode == "trending"
        and category is None
        and window_days in (7, 30)
        and top_k <= 50
    ):
        raw = await cache_get(f"precompute:v1:trending:w{window_days}")
        if raw:
            try:
                data = json.loads(raw)
                items_raw = data.get("items") or []
                sliced = items_raw[:top_k]
                if sliced:
                    return ColdStartRecommendationResponse(
                        mode=mode,
                        window_days=window_days,
                        items=[
                            ColdStartItem(
                                product_id=str(x["product_id"]),
                                score=float(x["score"]),
                            )
                            for x in sliced
                        ],
                    )
            except (KeyError, TypeError, ValueError):
                pass

    rows = await cold_start_recommend(
        db,
        top_k=top_k,
        mode=mode,
        window_days=window_days,
        category=category,
    )
    return ColdStartRecommendationResponse(
        mode=mode,
        window_days=window_days,
        items=[ColdStartItem(**x) for x in rows],
    )


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
        f"hybrid:v2:{interaction_n}:{product_n}:{user_id}:"
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

    strategy = "hybrid"
    if not rows:
        cold_rows = await cold_start_recommend(db, top_k=top_k, mode="trending")
        rows = [
            {
                "product_id": x["product_id"],
                "hybrid_score": x["score"],
                "collaborative_norm": 0.0,
                "content_similarity": 0.0,
                "estimated_rating": 0.0,
            }
            for x in cold_rows
        ]
        nw_cf, nw_ct = 0.0, 0.0
        strategy = "cold_start_trending"

    resp = HybridRecommendationResponse(
        user_id=user_id,
        strategy=strategy,
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


@router.post("/batch/hybrid", response_model=HybridBatchResponse)
async def hybrid_batch(
    body: HybridBatchRequest,
    db: Db,
) -> HybridBatchResponse:
    batch = await hybrid_recommend_batch(
        db,
        body.user_ids,
        body.top_k,
        body.w_collaborative,
        body.w_content,
        max_pool=body.max_pool,
    )
    results: list[HybridRecommendationResponse] = []
    for user_id, rows, nw_cf, nw_ct in batch:
        strategy = "hybrid"
        if not rows:
            cold_rows = await cold_start_recommend(
                db, top_k=body.top_k, mode="trending"
            )
            rows = [
                {
                    "product_id": x["product_id"],
                    "hybrid_score": x["score"],
                    "collaborative_norm": 0.0,
                    "content_similarity": 0.0,
                    "estimated_rating": 0.0,
                }
                for x in cold_rows
            ]
            nw_cf, nw_ct = 0.0, 0.0
            strategy = "cold_start_trending"
        results.append(
            HybridRecommendationResponse(
                user_id=user_id,
                strategy=strategy,
                weight_collaborative=nw_cf,
                weight_content=nw_ct,
                items=[HybridItem(**r) for r in rows],
            )
        )
    return HybridBatchResponse(results=results)

