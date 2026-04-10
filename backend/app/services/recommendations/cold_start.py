"""Cold-start recommendations (popular + trending) from interaction logs."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Literal

from motor.motor_asyncio import AsyncIOMotorDatabase


def _event_weight(event_type: str) -> float:
    return {
        "view": 1.0,
        "click": 2.0,
        "purchase": 5.0,
        "rating": 3.0,
    }.get(event_type, 1.0)


async def cold_start_recommend(
    db: AsyncIOMotorDatabase,
    top_k: int = 10,
    mode: Literal["popular", "trending"] = "trending",
    window_days: int = 30,
) -> list[dict[str, float | str]]:
    now = datetime.now(timezone.utc)
    products = await db.products.find({}).to_list(length=50_000)
    if not products:
        return []

    by_pid = {str(p["_id"]): p for p in products}
    scores: dict[str, float] = defaultdict(float)

    interactions = await db.interactions.find({}).to_list(length=200_000)
    for x in interactions:
        pid = str(x.get("product_id") or "")
        if pid not in by_pid:
            continue
        base = _event_weight(str(x.get("event_type") or "view"))
        if mode == "popular":
            scores[pid] += base
            continue

        created = x.get("created_at")
        if created is None:
            continue
        age_days = max(0.0, (now - created).total_seconds() / 86400)
        if age_days > window_days:
            continue
        decay = math.exp(-age_days / max(1.0, window_days / 2))
        scores[pid] += base * decay

    if not scores:
        ranked = sorted(
            (
                (str(p["_id"]), float((now - p["created_at"]).total_seconds()))
                for p in products
                if p.get("created_at")
            ),
            key=lambda x: x[1],
        )
        return [
            {"product_id": pid, "score": float(top_k - i)}
            for i, (pid, _) in enumerate(ranked[:top_k])
        ]

    ranked = sorted(scores.items(), key=lambda x: -x[1])[:top_k]
    return [{"product_id": pid, "score": float(score)} for pid, score in ranked]

