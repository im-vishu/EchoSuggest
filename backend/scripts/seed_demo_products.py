"""Load demo products via the local API. Requires backend running (default http://127.0.0.1:8000)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("ECHOSUGGEST_API", "http://127.0.0.1:8000").rstrip("/")

DEMO = [
    {
        "title": "Wireless Noise-Canceling Headphones",
        "description": "Over-ear Bluetooth headphones with 30h battery and plush ear cups.",
        "category": "Electronics",
        "tags": ["audio", "travel", "bluetooth"],
        "price": 199.99,
        "sku": "AUD-100",
    },
    {
        "title": "Studio Reference Headphones",
        "description": "Wired open-back headphones for mixing and critical listening.",
        "category": "Electronics",
        "tags": ["audio", "studio", "music production"],
        "price": 149.0,
        "sku": "AUD-200",
    },
    {
        "title": "Mechanical Keyboard — Tactile",
        "description": "Hot-swappable 75% keyboard with PBT keycaps and USB-C.",
        "category": "Electronics",
        "tags": ["keyboard", "gaming", "office"],
        "price": 129.0,
        "sku": "KBD-75",
    },
    {
        "title": "Ergonomic Office Chair",
        "description": "Mesh back, lumbar support, adjustable arms for long work sessions.",
        "category": "Furniture",
        "tags": ["office", "ergonomic", "home"],
        "price": 349.0,
        "sku": "CHR-01",
    },
    {
        "title": "Standing Desk Frame",
        "description": "Electric height-adjustable desk frame with memory presets.",
        "category": "Furniture",
        "tags": ["office", "desk", "ergonomic"],
        "price": 399.0,
        "sku": "DSK-FR",
    },
    {
        "title": "Ceramic Pour-Over Coffee Set",
        "description": "Dripper, server, and filters for manual brewing enthusiasts.",
        "category": "Kitchen",
        "tags": ["coffee", "brewing", "gift"],
        "price": 45.0,
        "sku": "KIT-COF",
    },
]


def main() -> int:
    url = f"{BASE}/api/v1/products/bulk"
    data = json.dumps(DEMO).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        print(e.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1
    print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
