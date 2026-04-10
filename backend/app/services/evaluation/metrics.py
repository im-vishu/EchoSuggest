"""Ranking metrics for offline evaluation."""


def precision_at_k(recommended_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Fraction of top-k recommendations that are relevant (set-based)."""
    if k <= 0 or not relevant_ids:
        return 0.0
    top = recommended_ids[:k]
    if not top:
        return 0.0
    hits = sum(1 for x in top if x in relevant_ids)
    return hits / k


def recall_at_k(recommended_ids: list[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    top = set(recommended_ids[:k])
    hits = len(top & relevant_ids)
    return hits / len(relevant_ids)
