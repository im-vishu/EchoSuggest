"""Last-interaction holdout for collaborative Precision@K."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.evaluation.metrics import precision_at_k
from app.services.recommendations.collaborative import (
    fit_collaborative_from_list,
    recommend_for_user,
)


async def run_collaborative_precision_holdout(
    db: AsyncIOMotorDatabase,
    k: int = 10,
    max_users: int = 100,
) -> dict[str, Any]:
    """
    For each user with ≥2 interactions (chronological), hold out the last event,
    train SVD on prior events, and check if the held-out product appears in top-k.
    """
    docs = (
        await db.interactions.find({})
        .sort("created_at", 1)
        .to_list(length=200_000)
    )
    by_user: dict[str, list[dict]] = defaultdict(list)
    for d in docs:
        by_user[str(d["user_id"])].append(d)

    train_docs: list[dict] = []
    eval_rows: list[tuple[str, str]] = []
    for uid, rows in by_user.items():
        if len(rows) < 2:
            train_docs.extend(rows)
            continue
        ordered = sorted(rows, key=lambda x: x["created_at"])
        held = ordered[-1]
        train_docs.extend(ordered[:-1])
        eval_rows.append((uid, str(held["product_id"])))

    if len(train_docs) < 5:
        return {
            "k": k,
            "users_evaluated": 0,
            "mean_precision_at_k": 0.0,
            "detail": "not_enough_training_interactions",
        }

    model, train_map = fit_collaborative_from_list(train_docs)
    products = await db.products.find({}, {"_id": 1}).to_list(length=50_000)
    catalog = [str(p["_id"]) for p in products]

    if model is None:
        return {
            "k": k,
            "users_evaluated": 0,
            "mean_precision_at_k": 0.0,
            "detail": "svd_not_fittable_on_training_slice",
        }

    precisions: list[float] = []
    n = 0
    for uid, target_pid in eval_rows:
        if n >= max_users:
            break
        history = train_map.get(uid, set())
        pairs = recommend_for_user(model, uid, k, catalog, history)
        rec_ids = [p for p, _ in pairs]
        precisions.append(precision_at_k(rec_ids, {target_pid}, k=k))
        n += 1

    mean_p = sum(precisions) / len(precisions) if precisions else 0.0
    return {
        "k": k,
        "users_evaluated": len(precisions),
        "mean_precision_at_k": round(mean_p, 4),
        "detail": "last_event_holdout_per_user",
    }
