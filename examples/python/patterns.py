"""Small interview models. Each docstring states the production boundary."""

from dataclasses import dataclass
from hashlib import sha256
from math import ceil
from threading import Lock
from time import monotonic
from typing import Callable


def estimate_capacity(daily_requests: int, peak_factor: float, bytes_per_item: int,
                      retention_days: int, replicas: int = 3) -> dict[str, float]:
    """Assume one stored item per request; excludes indexes and protocol overhead."""
    if daily_requests < 0 or peak_factor < 1 or bytes_per_item < 0:
        raise ValueError("Use nonnegative counts and a peak factor of at least one")
    if retention_days < 1 or replicas < 1:
        raise ValueError("Retention and replicas must be positive")
    average_rps = daily_requests / 86_400
    return {
        "average_rps": average_rps,
        "peak_rps": ceil(average_rps * peak_factor),
        "storage_bytes": daily_requests * bytes_per_item * retention_days * replicas,
        "peak_bytes_per_second": ceil(average_rps * peak_factor) * bytes_per_item,
    }


@dataclass
class TokenBucket:
    """Single-thread teaching model; distributed checks need an atomic store update."""

    capacity: float
    refill_per_second: float
    clock: Callable[[], float] = monotonic

    def __post_init__(self) -> None:
        if self.capacity <= 0 or self.refill_per_second <= 0:
            raise ValueError("Capacity and refill rate must be positive")
        self.tokens = self.capacity
        self.updated_at = self.clock()

    def allow(self, cost: float = 1) -> bool:
        if cost <= 0:
            raise ValueError("Cost must be positive")
        now = self.clock()
        elapsed = max(0, now - self.updated_at)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_second)
        self.updated_at = max(now, self.updated_at)
        if self.tokens < cost:
            return False
        self.tokens -= cost
        return True


def rollout_enabled(flag: str, user: str, percentage: float) -> bool:
    """Stable across processes; production SDKs must share encoding and hash rules."""
    if not 0 <= percentage <= 100:
        raise ValueError("Percentage must be between 0 and 100")
    identity = f"{len(flag)}:{flag}{user}".encode("utf-8")
    bucket = int.from_bytes(sha256(identity).digest()[:8], "big") % 10_000
    return bucket < percentage * 100


def page_after(rows: list[tuple[int, str]], cursor: tuple[int, str] | None,
               limit: int = 20) -> list[tuple[int, str]]:
    """Ascending (timestamp, unique_id) cursor; a database needs a composite index."""
    if not 1 <= limit <= 100:
        raise ValueError("Page size must be between 1 and 100")
    return [row for row in sorted(rows) if cursor is None or row > cursor][:limit]


def chunk_digest(data: bytes) -> str:
    """Content addressing only; authorization must be checked independently."""
    return sha256(data).hexdigest()


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Fuse authorized lexical/vector results; filter by tenant ACL before ranking."""
    if k < 1:
        raise ValueError("Rank constant must be positive")
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, document in enumerate(dict.fromkeys(ranking), start=1):
            scores[document] = scores.get(document, 0) + 1 / (k + rank)
    return sorted(scores, key=lambda document: (-scores[document], document))


class Ledger:
    """In-memory, one-process transfers in integer minor units; no durability.

    Production: commit the balanced entries, unique idempotency key, and outbox
    in one database transaction. Reconcile against external settlement records.
    """

    def __init__(self, balances: dict[str, int]):
        if any(type(value) is not int or value < 0 for value in balances.values()):
            raise ValueError("Balances must be nonnegative integer minor units")
        self._balances = dict(balances)
        self._requests: dict[str, tuple[str, str, int]] = {}
        self._lock = Lock()

    def transfer(self, key: str, source: str, target: str, amount: int) -> None:
        if not key or type(amount) is not int or amount <= 0 or source == target:
            raise ValueError("Use a key, distinct accounts, and a positive integer amount")
        request = (source, target, amount)
        with self._lock:
            if key in self._requests:
                if self._requests[key] != request:
                    raise ValueError("Idempotency key reused for a different transfer")
                return
            if source not in self._balances or target not in self._balances:
                raise ValueError("Unknown account")
            if self._balances[source] < amount:
                raise ValueError("Insufficient funds")
            self._balances[source] -= amount
            self._balances[target] += amount
            self._requests[key] = request

    def balance(self, account: str) -> int:
        with self._lock:
            return self._balances[account]
