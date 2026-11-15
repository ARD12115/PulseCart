import asyncio
import json
import logging
import os

import asyncpg
from aiokafka import AIOKafkaProducer
from dotenv import load_dotenv

from app.connections import PROJECT_ROOT, kafka_client_options, postgres_connection_kwargs
from app.resilience import configure_logging

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
POLL_INTERVAL = 1.0
BATCH_SIZE = 100
MAX_BACKOFF = 30.0
log = logging.getLogger("pulsecart.relay")


async def publish_batch(pool: asyncpg.Pool, producer) -> int:
    """Publish up to BATCH_SIZE unpublished events; return how many were sent.

    Rows are locked with FOR UPDATE SKIP LOCKED, so several relays can run side by side
    without publishing the same event twice. Events sent before a Kafka error are still
    marked published (and committed); the error is re-raised afterwards so the caller backs
    off and retries the rest.
    """
    failure: Exception | None = None
    sent = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """SELECT id, topic, key, payload FROM outbox_events
                   WHERE published_at IS NULL ORDER BY id LIMIT $1
                   FOR UPDATE SKIP LOCKED""",
                BATCH_SIZE,
            )
            for row in rows:
                payload = row["payload"]
                if isinstance(payload, str):
                    payload = json.loads(payload)
                payload = {**payload, "outbox_event_id": row["id"]}
                try:
                    await producer.send_and_wait(
                        row["topic"],
                        key=row["key"].encode("utf-8"),
                        value=json.dumps(payload).encode("utf-8"),
                    )
                except Exception as exc:
                    failure = exc
                    break
                await conn.execute(
                    "UPDATE outbox_events SET published_at = now() WHERE id = $1", row["id"]
                )
                sent += 1
                log.info("Published event %s to %s", row["id"], row["topic"])
    if failure is not None:
        raise failure
    return sent


async def main() -> None:
    configure_logging()
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=4, **postgres_connection_kwargs()
    )
    producer = AIOKafkaProducer(
        **kafka_client_options(),
        acks="all",
        enable_idempotence=True,
    )
    failures = 0
    try:
        await producer.start()
        log.info("Outbox relay started")
        while True:
            try:
                sent = await publish_batch(pool, producer)
                failures = 0
                if sent < BATCH_SIZE:  # keep draining without sleeping while backlogged
                    await asyncio.sleep(POLL_INTERVAL)
            except asyncio.CancelledError:
                raise
            except Exception:
                failures += 1
                delay = min(MAX_BACKOFF, 2.0**failures)
                log.exception("Relay iteration failed; retrying in %.0fs", delay)
                await asyncio.sleep(delay)
    finally:
        await producer.stop()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
