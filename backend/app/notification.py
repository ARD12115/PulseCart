import asyncio
import json
import os

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv

from app.connections import PROJECT_ROOT, kafka_client_options, postgres_connection_kwargs

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
CONSUMER_NAME = "notification"


async def main() -> None:
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=4, **postgres_connection_kwargs()
    )
    consumer = AIOKafkaConsumer(
        "order.placed",
        **kafka_client_options(),
        group_id=CONSUMER_NAME,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )
    try:
        await consumer.start()
        print("Notification consumer started")
        async for message in consumer:
            payload = message.value
            event_id = payload.get("outbox_event_id")
            async with pool.acquire() as conn:
                async with conn.transaction():
                    if event_id is not None:
                        already_processed = await conn.fetchval(
                            """SELECT EXISTS(SELECT 1 FROM processed_events
                               WHERE consumer = $1 AND event_id = $2)""",
                            CONSUMER_NAME,
                            event_id,
                        )
                    else:
                        already_processed = False
                    if not already_processed:
                        print(
                            "ORDER CONFIRMED "
                            f"order={payload['order_id']} "
                            f"customer={payload['customer_id']} "
                            f"total_paise={payload['total_paise']}"
                        )
                        if event_id is not None:
                            await conn.execute(
                                """INSERT INTO processed_events (consumer, event_id)
                                   VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                                CONSUMER_NAME,
                                event_id,
                            )
            await consumer.commit()
    finally:
        await consumer.stop()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
