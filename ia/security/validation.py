from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class SlidingWindowRateLimiter:
    """Limitador em memória adequado ao serviço local de instância única.

    Para múltiplas réplicas, substitua por um armazenamento compartilhado antes do deploy.
    """

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        async with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(window_seconds - (now - events[0])))
                raise HTTPException(
                    status_code=429,
                    detail="Muitas solicitações. Aguarde um pouco e tente novamente.",
                    headers={"Retry-After": str(retry_after)},
                )
            events.append(now)

            # Limpeza periódica de chaves expiradas para evitar crescimento indefinido.
            if len(self._events) > 2_000:
                expired = [
                    item_key for item_key, item_events in self._events.items()
                    if not item_events or item_events[-1] <= cutoff
                ]
                for item_key in expired:
                    self._events.pop(item_key, None)


rate_limiter = SlidingWindowRateLimiter()


async def enforce_user_rate_limit(user_id: str, operation: str, limit: int, window_seconds: int) -> None:
    await rate_limiter.check(f"{operation}:{user_id}", limit, window_seconds)
