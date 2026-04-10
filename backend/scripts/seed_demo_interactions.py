"""Create demo interactions via the API. Run after products exist (see seed_demo_products.py)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("ECHOSUGGEST_API", "http://127.0.0.1:8000").rstrip("/")


def _get_json(url: str) -> object:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _post_json(url: str, payload: object) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def main() -> int:
    products_url = f"{BASE}/api/v1/products?limit=50"
    try:
        raw = _get_json(products_url)
    except urllib.error.URLError as e:
        print(f"GET products failed: {e}", file=sys.stderr)
        return 1
    if not isinstance(raw, list) or len(raw) < 3:
        print("Need at least 3 products. Run seed_demo_products.py first.", file=sys.stderr)
        return 1

    ids = [str(p["id"]) for p in raw]
    interactions = [
        {"user_id": "demo-alice", "product_id": ids[0], "event_type": "view"},
        {"user_id": "demo-alice", "product_id": ids[0], "event_type": "click"},
        {"user_id": "demo-alice", "product_id": ids[1], "event_type": "rating", "rating": 5.0},
        {"user_id": "demo-alice", "product_id": ids[2], "event_type": "purchase"},
        {"user_id": "demo-bob", "product_id": ids[1], "event_type": "view"},
        {"user_id": "demo-bob", "product_id": ids[1], "event_type": "click"},
        {"user_id": "demo-bob", "product_id": ids[2], "event_type": "rating", "rating": 4.0},
        {"user_id": "demo-bob", "product_id": ids[3] if len(ids) > 3 else ids[0], "event_type": "click"},
        {"user_id": "demo-carol", "product_id": ids[2], "event_type": "view"},
        {"user_id": "demo-carol", "product_id": ids[3] if len(ids) > 3 else ids[1], "event_type": "rating", "rating": 3.0},
        {"user_id": "demo-carol", "product_id": ids[4] if len(ids) > 4 else ids[0], "event_type": "purchase"},
    ]

    url = f"{BASE}/api/v1/interactions"
    for body in interactions:
        code, text = _post_json(url, body)
        if code not in (200, 201):
            print(f"{code}: {text}", file=sys.stderr)
            return 1
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
