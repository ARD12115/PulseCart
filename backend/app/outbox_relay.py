import asyncio
import json
import os

import asyncpg
from aiokafka import AIOKafkaProducer
from dotenv import load_dotenv

from app.connections import PROJECT_ROOT, kafka_client_options

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
POLL_INTERVAL = 1.0
BATCH_SIZE = 100


async def main() -> None:
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=4)
    producer = AIOKafkaProducer(
        **kafka_client_options(),
        acks="all",
        enable_idempotence=True,
    )
    try:
        await producer.start()
        print("Outbox relay started")
        while True:
            rows = await pool.fetch(
                """SELECT id, topic, key, payload FROM outbox_events
                   WHERE published_at IS NULL ORDER BY id LIMIT $1""",
                BATCH_SIZE,
            )
            for row in rows:
                payload = row["payload"]
                if isinstance(payload, str):
                    payload = json.loads(payload)
                payload = {**payload, "outbox_event_id": row["id"]}
                await producer.send_and_wait(
                    row["topic"],
                    key=row["key"].encode("utf-8"),
                    value=json.dumps(payload).encode("utf-8"),
                )
                await pool.execute(
                    "UPDATE outbox_events SET published_at = now() WHERE id = $1 AND published_at IS NULL",
                    row["id"],
                )
                print(f"Published event {row['id']} to {row['topic']}")
            await asyncio.sleep(POLL_INTERVAL)
    finally:
        await producer.stop()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
