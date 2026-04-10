"""Optional async Redis client for recommendation caching."""

from __future__ import annotations

import logging

import redis.asyncio as redis

from app.core.config import settings

log = logging.getLogger(__name__)

_client: redis.Redis | None = None


async def redis_connect() -> None:
    global _client
    try:
        _client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2.0,
        )
        await _client.ping()
        log.info("Redis connected for cache")
    except Exception as e:
        _client = None
        log.warning("Redis unavailable (%s); hybrid cache disabled", e)


async def redis_close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def cache_get(key: str) -> str | None:
    if _client is None:
        return None
    try:
        return await _client.get(key)
    except Exception as e:
        log.warning("Redis get failed: %s", e)
        return None


async def cache_set(key: str, value: str, ttl_seconds: int) -> None:
    if _client is None:
        return
    try:
        await _client.setex(key, ttl_seconds, value)
    except Exception as e:
        log.warning("Redis set failed: %s", e)
