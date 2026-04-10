"""Content-based recommendations: TF-IDF over product text + cosine similarity."""

from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _product_text(product: dict) -> str:
    parts = [
        str(product.get("title") or ""),
        str(product.get("description") or ""),
        str(product.get("category") or ""),
        " ".join(product.get("tags") or []),
    ]
    return " ".join(parts).strip()


class ContentRecommender:
    def __init__(self) -> None:
        self._vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=4096,
            ngram_range=(1, 2),
            min_df=1,
        )
        self._matrix = None
        self._ids: list[str] = []

    def fit(self, products: list[dict]) -> None:
        self._ids = [str(p["_id"]) for p in products]
        texts = [_product_text(p) for p in products]
        if not self._ids:
            self._matrix = None
            return
        self._matrix = self._vectorizer.fit_transform(texts)

    def similar(self, product_id: str, top_k: int = 10) -> list[tuple[str, float]]:
        if self._matrix is None or not self._ids or top_k <= 0:
            return []
        try:
            idx = self._ids.index(product_id)
        except ValueError:
            return []
        sims = cosine_similarity(self._matrix[idx], self._matrix).flatten()
        order = np.argsort(-sims)
        out: list[tuple[str, float]] = []
        for j in order:
            if int(j) == idx:
                continue
            out.append((self._ids[int(j)], float(sims[int(j)])))
            if len(out) >= top_k:
                break
        return out

    def max_similarity_to_history(
        self, candidate_id: str, history_product_ids: set[str]
    ) -> float:
        """Max cosine similarity between candidate and any product the user interacted with."""
        if self._matrix is None or not self._ids or not history_product_ids:
            return 0.0
        try:
            ci = self._ids.index(candidate_id)
        except ValueError:
            return 0.0
        idxs: list[int] = []
        for h in history_product_ids:
            try:
                idxs.append(self._ids.index(h))
            except ValueError:
                continue
        if not idxs:
            return 0.0
        v = self._matrix[ci]
        other = self._matrix[idxs]
        sims = cosine_similarity(v, other).flatten()
        return float(np.max(sims))
