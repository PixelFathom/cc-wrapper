from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union
from uuid import UUID

import redis.asyncio as redis

DEFAULT_LIMIT = 200
DEFAULT_WINDOW_SECONDS = 24 * 60 * 60  # 24 hours


@dataclass
class RateLimitResult:
    count: int
    remaining: int
    limit: int
    window_seconds: int
    retry_after: Optional[int]


class RateLimitExceeded(Exception):
    """Raised when a user exceeds the allowed number of requests."""

    def __init__(
        self,
        *,
        limit: int,
        window_seconds: int,
        retry_after: Optional[int] = None,
    ) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.retry_after = retry_after
        hours = max(window_seconds // 3600, 1)
        message = f"Rate limit exceeded: {limit} requests per {hours} hour window."
        super().__init__(message)


async def _ensure_expiry(
    client: redis.Redis,
    key: str,
    window_seconds: int,
) -> int:
    """Ensure the key has an expiry and return the ttl."""
    ttl = await client.ttl(key)
    if ttl == -1:
        # Key exists but has no expiry set, enforce it now
        await client.expire(key, window_seconds)
        ttl = window_seconds
    elif ttl == -2:
        # Key missing (should not happen immediately after incr) but guard anyway
        ttl = window_seconds
    return ttl


async def assert_within_rate_limit(
    client: redis.Redis,
    *,
    user_id: Union[str, UUID],
    limit: int = DEFAULT_LIMIT,
    window_seconds: int = DEFAULT_WINDOW_SECONDS,
    metric: str = "requests",
    consume: bool = True,
) -> RateLimitResult:
    """
    Increment and validate the rate limit counter for the given user.

    Args:
        client: Redis client instance.
        user_id: Identifier of the authenticated user.
        limit: Maximum number of requests allowed within the window.
        window_seconds: Time window for rate limiting in seconds.
        metric: Optional suffix to distinguish multiple counters per user.
        consume: When False, perform a dry-run check without incrementing.

    Raises:
        RateLimitExceeded: when the incremented counter exceeds the allowed limit.
    """
    user_key = f"user:{user_id}:{metric}"

    if consume:
        current_count = await client.incr(user_key)
        if current_count == 1:
            # First increment – set the window expiry
            await client.expire(user_key, window_seconds)
        ttl = await _ensure_expiry(client, user_key, window_seconds)
        over_limit = current_count > limit
    else:
        raw_value = await client.get(user_key)
        current_count = int(raw_value) if raw_value is not None else 0
        ttl = await _ensure_expiry(client, user_key, window_seconds) if current_count > 0 else window_seconds
        over_limit = current_count >= limit

    if over_limit:
        raise RateLimitExceeded(
            limit=limit,
            window_seconds=window_seconds,
            retry_after=ttl if ttl > 0 else None,
        )

    remaining = max(limit - current_count, 0)
    return RateLimitResult(
        count=current_count,
        remaining=remaining,
        limit=limit,
        window_seconds=window_seconds,
        retry_after=ttl if ttl > 0 else None,
    )


