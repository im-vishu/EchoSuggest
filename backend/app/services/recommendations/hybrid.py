"""Blend collaborative (SVD) and content (TF-IDF) scores."""

from __future__ import annotations

import asyncio
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.recommendations.collaborative import (
    SVDMatrixFactorization,
    load_or_fit_collaborative,
)
from app.services.recommendations.content import ContentRecommender


def _minmax(scores: dict[str, float]) -> dict[str, float]:
    if not scores:
        return {}
    vals = list(scores.values())
    lo, hi = min(vals), max(vals)
    if hi - lo < 1e-9:
        return {k: 0.5 for k in scores}
    return {k: (v - lo) / (hi - lo) for k, v in scores.items()}


def _norm_weights(w_cf: float, w_content: float) -> tuple[float, float]:
    s = w_cf + w_content
    if s <= 1e-9:
        return 0.6, 0.4
    return w_cf / s, w_content / s


def _hybrid_rows_for_user(
    user_id: str,
    top_k: int,
    w_cf: float,
    w_content: float,
    max_pool: int,
    model: SVDMatrixFactorization | None,
    raw_map: dict[str, set[str]],
    catalog: list[str],
    recommender: ContentRecommender,
) -> list[dict[str, Any]]:
    """Single-user scoring after collaborative model and content recommender are fitted."""
    history = set(raw_map.get(user_id, set()))
    if not history:
        # Preserve the public contract: cold-start users should use the trending fallback
        # path instead of synthetic collaborative-only rankings.
        return []

    cf_by_pid: dict[str, float] = {}
    for pid in catalog:
        if pid in history:
            continue
        if model is not None:
            cf_by_pid[pid] = model.predict(user_id, pid)
        else:
            cf_by_pid[pid] = 3.0

    pool: set[str] = set()
    sorted_cf = sorted(cf_by_pid.items(), key=lambda x: -x[1])
    pool.update(pid for pid, _ in sorted_cf[: max(1, max_pool // 2)])

    if history:
        for h in list(history)[:12]:
            for sid, _ in recommender.similar(h, top_k=8):
                if sid not in history:
                    pool.add(sid)
                    if sid not in cf_by_pid:
                        cf_by_pid[sid] = (
                            model.predict(user_id, sid) if model is not None else 3.0
                        )

    pool = {p for p in pool if p not in history}
    if len(pool) > max_pool:
        ranked = sorted(
            ((p, cf_by_pid.get(p, 0.0)) for p in pool),
            key=lambda x: -x[1],
        )[:max_pool]
        pool = {p for p, _ in ranked}

    w_cf_eff, w_c_eff = w_cf, w_content

    pool_cf = {p: cf_by_pid[p] for p in pool if p in cf_by_pid}
    norm_cf = _minmax(pool_cf)

    out: list[dict[str, Any]] = []
    for p in pool:
        cf_raw = cf_by_pid.get(p, 3.0)
        cf_n = norm_cf.get(p, 0.5)
        c_sim = (
            recommender.max_similarity_to_history(p, history) if history else 0.0
        )
        hybrid = w_cf_eff * cf_n + w_c_eff * c_sim
        out.append(
            {
                "product_id": p,
                "hybrid_score": hybrid,
                "collaborative_norm": cf_n,
                "content_similarity": c_sim,
                "estimated_rating": cf_raw,
            }
        )

    out.sort(key=lambda x: -x["hybrid_score"])
    return out[:top_k]


async def hybrid_recommend(
    db: AsyncIOMotorDatabase,
    user_id: str,
    top_k: int,
    w_cf: float,
    w_content: float,
    max_pool: int = 200,
) -> tuple[list[dict[str, Any]], float, float]:
    """
    Returns (rows, weight_collaborative, weight_content) after L1-normalizing weights.
    Each row: product_id, hybrid_score, collaborative_norm, content_similarity,
    estimated_rating.
    """
    w_cf, w_content = _norm_weights(w_cf, w_content)
    model, raw_map, catalog = await load_or_fit_collaborative(db)

    products = await db.products.find({}).to_list(length=10_000)
    if len(products) < 2:
        return [], w_cf, w_content

    recommender = ContentRecommender()

    def _fit_content() -> None:
        recommender.fit(products)

    await asyncio.to_thread(_fit_content)

    rows = _hybrid_rows_for_user(
        user_id,
        top_k,
        w_cf,
        w_content,
        max_pool,
        model,
        raw_map,
        catalog,
        recommender,
    )
    return rows, w_cf, w_content


async def hybrid_recommend_batch(
    db: AsyncIOMotorDatabase,
    user_ids: list[str],
    top_k: int,
    w_cf: float,
    w_content: float,
    max_pool: int = 200,
) -> list[tuple[str, list[dict[str, Any]], float, float]]:
    """
    One collaborative load + one content fit, then score many users (lower latency
    than sequential GET /hybrid calls).
    """
    w_cf, w_content = _norm_weights(w_cf, w_content)
    model, raw_map, catalog = await load_or_fit_collaborative(db)

    products = await db.products.find({}).to_list(length=10_000)
    if len(products) < 2:
        return [(uid, [], w_cf, w_content) for uid in user_ids]

    recommender = ContentRecommender()

    def _fit_content() -> None:
        recommender.fit(products)

    await asyncio.to_thread(_fit_content)

    return [
        (
            uid,
            _hybrid_rows_for_user(
                uid,
                top_k,
                w_cf,
                w_content,
                max_pool,
                model,
                raw_map,
                catalog,
                recommender,
            ),
            w_cf,
            w_content,
        )
        for uid in user_ids
    ]
