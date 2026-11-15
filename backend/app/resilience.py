"""Shared helpers that keep Kafka consumers alive when a message is bad."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import asyncpg

log = logging.getLogger("pulsecart")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )


def safe_json_loads(value: bytes | None) -> dict:
    """Deserialize a Kafka value without ever raising.

    A malformed message becomes a marker dict that the handler rejects, so it ends up in
    the dead-letter table instead of crashing the consumer in a restart loop.
    """
    try:
        decoded = json.loads(value.decode("utf-8")) if value is not None else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        decoded = None
    if isinstance(decoded, dict):
        return decoded
    raw = value.decode("utf-8", errors="replace") if value is not None else ""
    return {"_malformed": True, "_raw": raw[:2000]}


async def record_dead_letter(
    pool: asyncpg.Pool, consumer: str, message, error: BaseException
) -> None:
    key = message.key.decode("utf-8", errors="replace") if message.key else None
    await pool.execute(
        """INSERT INTO dead_letter_events
               (consumer, topic, kafka_partition, kafka_offset, key, value, error)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        consumer,
        message.topic,
        message.partition,
        message.offset,
        key,
        json.dumps(message.value, default=str),
        f"{type(error).__name__}: {error}"[:1000],
    )


async def handle_with_retry(
    message,
    handler: Callable[[object], Awaitable[None]],
    pool: asyncpg.Pool,
    consumer: str,
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
) -> bool:
    """Run handler(message) with retries. Returns True on success, False if dead-lettered.

    If the dead-letter write itself fails (for example the database is down) the error
    propagates: the process exits, Docker restarts it, and the uncommitted message is
    redelivered. A message is only skipped once it has been safely recorded.
    """
    last_error: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            await handler(message)
            return True
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            last_error = exc
            log.warning(
                "%s: attempt %d/%d failed for %s[%s]@%s: %s",
                consumer, attempt, attempts, message.topic, message.partition,
                message.offset, exc,
            )
            if attempt < attempts:
                await asyncio.sleep(base_delay * 2 ** (attempt - 1))
    assert last_error is not None
    await record_dead_letter(pool, consumer, message, last_error)
    log.error("%s: dead-lettered %s@%s", consumer, message.topic, message.offset)
    return False
