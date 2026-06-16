"""A tiny in-process rate limiter — a per-key sliding window held in memory.

The app runs as a single uvicorn worker (see the Render start command), so an
in-memory window is enough to blunt enquiry-form spam and password guessing without
pulling in Redis. If we ever scale to multiple workers/instances, move the store
behind a shared cache so the window is counted across processes.

Usage is a read-then-write pair so the caller controls what counts:

    if ratelimit.count(key, WINDOW) >= MAX:
        raise HTTPException(429, "…")     # already over the allowance
    ratelimit.record(key, WINDOW)          # count this attempt
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

# key -> deque of monotonic timestamps (oldest first)
_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def client_ip(request: Request) -> str:
    """Best-effort caller IP. Behind Render (and most PaaS) the real client address is
    the first entry of X-Forwarded-For; fall back to the socket peer for local/dev.

    Note: X-Forwarded-For is client-supplied and can be spoofed, so this is a speed
    bump against casual abuse, not a defence against a determined attacker rotating
    headers (who can rotate real IPs anyway)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def count(key: str, window_seconds: int) -> int:
    """Hits recorded for `key` within the trailing window (read-only). Prunes expired
    entries and drops the bucket entirely when it empties, so the map stays bounded to
    recently-active keys."""
    cutoff = time.monotonic() - window_seconds
    with _lock:
        hits = _hits.get(key)
        if not hits:
            return 0
        while hits and hits[0] < cutoff:
            hits.popleft()
        if not hits:
            _hits.pop(key, None)
            return 0
        return len(hits)


def record(key: str, window_seconds: int) -> None:
    """Record a hit for `key` now (trimming anything already outside the window)."""
    now = time.monotonic()
    cutoff = now - window_seconds
    with _lock:
        hits = _hits[key]
        while hits and hits[0] < cutoff:
            hits.popleft()
        hits.append(now)


def reset(key: str | None = None) -> None:
    """Clear one key (or everything when key is None). Used by tests."""
    with _lock:
        if key is None:
            _hits.clear()
        else:
            _hits.pop(key, None)
