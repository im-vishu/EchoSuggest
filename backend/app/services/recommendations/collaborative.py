"""Collaborative filtering via truncated SVD on the user–item rating matrix (SciPy)."""

from __future__ import annotations

import asyncio
import threading
from typing import Any

import numpy as np
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase
from scipy.sparse.linalg import svds

_lock = threading.Lock()
_cache: dict[str, Any] = {
    "data_key": None,
    "model": None,
    "raw_user_items": None,
    "all_product_ids": None,
}

_MIN_INTERACTIONS = 5
_MIN_USERS = 2
_MIN_ITEMS = 2


def _event_to_rating(row: dict) -> float:
    et = row.get("event_type")
    if et == "rating" and row.get("rating") is not None:
        return float(row["rating"])
    if et == "purchase":
        return 4.5
    if et == "click":
        return 3.0
    if et == "view":
        return 2.0
    return 2.5


def _build_dataframe(interactions: list[dict]) -> pd.DataFrame:
    rows: list[tuple[str, str, float]] = []
    for x in interactions:
        uid = str(x["user_id"])
        pid = str(x["product_id"])
        r = _event_to_rating(x)
        r = max(1.0, min(5.0, r))
        rows.append((uid, pid, r))
    df = pd.DataFrame(rows, columns=["user", "item", "rating"])
    if df.empty:
        return df
    return df.groupby(["user", "item"], as_index=False).rating.max()


def _user_item_sets(df: pd.DataFrame) -> dict[str, set[str]]:
    return {
        str(u): set(g["item"].astype(str).tolist()) for u, g in df.groupby("user")
    }


class SVDMatrixFactorization:
    """Truncated SVD factors (U, Sigma, Vt); scores are low-rank cell estimates."""

    def __init__(
        self,
        U: np.ndarray,
        s: np.ndarray,
        Vt: np.ndarray,
        user_map: dict[str, int],
        item_map: dict[str, int],
        global_mean: float,
    ) -> None:
        self._U = U
        self._s = s
        self._Vt = Vt
        self._user_map = user_map
        self._item_map = item_map
        self._global_mean = global_mean

    def predict(self, user_id: str, item_id: str) -> float:
        if item_id not in self._item_map:
            return self._global_mean
        j = self._item_map[item_id]
        if user_id not in self._user_map:
            col_scores = self._U @ np.diag(self._s) @ self._Vt[:, j]
            est = float(np.mean(col_scores))
            return float(max(1.0, min(5.0, est)))
        i = self._user_map[user_id]
        est = float(self._U[i] @ np.diag(self._s) @ self._Vt[:, j])
        return float(max(1.0, min(5.0, est)))


def _fit_svd(df: pd.DataFrame) -> SVDMatrixFactorization:
    users = df["user"].astype(str).unique().tolist()
    items = df["item"].astype(str).unique().tolist()
    user_map = {u: i for i, u in enumerate(users)}
    item_map = {it: j for j, it in enumerate(items)}
    n_users = len(users)
    n_items = len(items)
    R = np.zeros((n_users, n_items), dtype=np.float64)
    for row in df.itertuples(index=False):
        R[user_map[str(row.user)], item_map[str(row.item)]] = float(row.rating)
    global_mean = float(np.mean(R[R > 0])) if np.any(R > 0) else 3.0
    k = min(32, min(n_users, n_items) - 1)
    if k < 1:
        raise ValueError("invalid SVD rank")
    U, s, Vt = svds(R, k=k)
    U = U[:, ::-1]
    s = s[::-1]
    Vt = Vt[::-1, :]
    return SVDMatrixFactorization(U, s, Vt, user_map, item_map, global_mean)


def fit_collaborative_from_list(
    interactions: list[dict],
) -> tuple[SVDMatrixFactorization | None, dict[str, set[str]]]:
    """Train SVD from raw interaction docs (no Mongo cache). For evaluation holdouts."""
    if len(interactions) < _MIN_INTERACTIONS:
        return None, {}
    df = _build_dataframe(interactions)
    if df.empty:
        return None, {}
    raw_map = _user_item_sets(df)
    if df["user"].nunique() < _MIN_USERS or df["item"].nunique() < _MIN_ITEMS:
        return None, raw_map
    return _fit_svd(df), raw_map


def recommend_for_user(
    model: SVDMatrixFactorization,
    user_id: str,
    top_k: int,
    candidate_product_ids: list[str],
    user_history: set[str],
) -> list[tuple[str, float]]:
    scored: list[tuple[str, float]] = []
    for pid in candidate_product_ids:
        if pid in user_history:
            continue
        est = model.predict(user_id, pid)
        scored.append((pid, est))
    scored.sort(key=lambda x: -x[1])
    return scored[:top_k]


async def load_or_fit_collaborative(
    db: AsyncIOMotorDatabase,
) -> tuple[SVDMatrixFactorization | None, dict[str, set[str]], list[str]]:
    """Return (SVD model or None if insufficient data), user→items map, catalog ids."""
    interaction_n = await db.interactions.count_documents({})
    product_n = await db.products.count_documents({})
    data_key = (interaction_n, product_n)
    with _lock:
        if (
            data_key == _cache["data_key"]
            and _cache["raw_user_items"] is not None
            and _cache["all_product_ids"] is not None
        ):
            return (
                _cache["model"],
                _cache["raw_user_items"],
                _cache["all_product_ids"],
            )

    products = await db.products.find({}, {"_id": 1}).to_list(length=50_000)
    all_pids = [str(p["_id"]) for p in products]

    interactions = await db.interactions.find({}).to_list(length=200_000)

    def _train() -> tuple[SVDMatrixFactorization | None, dict[str, set[str]]]:
        return fit_collaborative_from_list(interactions)

    model, raw_map = await asyncio.to_thread(_train)
    if model is None:
        with _lock:
            _cache.update(
                {
                    "data_key": data_key,
                    "model": None,
                    "raw_user_items": raw_map,
                    "all_product_ids": all_pids,
                }
            )
        return None, raw_map, all_pids

    with _lock:
        _cache.update(
            {
                "data_key": data_key,
                "model": model,
                "raw_user_items": raw_map,
                "all_product_ids": all_pids,
            }
        )
    return model, raw_map, all_pids
