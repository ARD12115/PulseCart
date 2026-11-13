import asyncio
import json
import os

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv
from opensearchpy._async.client import AsyncOpenSearch
from opensearchpy.exceptions import NotFoundError

from app.connections import PROJECT_ROOT, kafka_client_options

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL")
CONSUMER_NAME = "search-sync"
INDEX_NAME = "products"


def create_client() -> AsyncOpenSearch:
    if not OPENSEARCH_URL:
        raise RuntimeError("OPENSEARCH_URL is not configured")
    return AsyncOpenSearch(
        OPENSEARCH_URL,
        use_ssl=OPENSEARCH_URL.startswith("https://"),
        verify_certs=True,
    )


async def ensure_index(client: AsyncOpenSearch) -> None:
    if await client.indices.exists(index=INDEX_NAME):
        return
    await client.indices.create(
        index=INDEX_NAME,
        body={
            "mappings": {
                "properties": {
                    "product_id": {"type": "long"},
                    "sku": {"type": "keyword"},
                    "name": {"type": "text"},
                    "description": {"type": "text"},
                    "category": {"type": "keyword"},
                    "price_paise": {"type": "integer"},
                    "image_url": {"type": "keyword"},
                    "city": {"type": "keyword"},
                    "stock": {"type": "integer"},
                }
            }
        },
    )


async def delete_product(client: AsyncOpenSearch, product_id: int, city: str) -> None:
    try:
        await client.delete(
            index=INDEX_NAME, id=f"{product_id}:{city}", refresh=True
        )
    except NotFoundError:
        return


async def upsert_product(
    client: AsyncOpenSearch,
    pool: asyncpg.Pool,
    product_id: int,
    city: str,
    stock: int,
) -> None:
    if stock <= 0:
        await delete_product(client, product_id, city)
        return
    product = await pool.fetchrow(
        """SELECT id, sku, name, description, category, price_paise, image_url
           FROM products WHERE id = $1""",
        product_id,
    )
    if product is None:
        return
    await client.index(
        index=INDEX_NAME,
        id=f"{product_id}:{city}",
        refresh=True,
        body={
            "product_id": product["id"],
            "sku": product["sku"],
            "name": product["name"],
            "description": product["description"],
            "category": product["category"],
            "price_paise": product["price_paise"],
            "image_url": product["image_url"],
            "city": city,
            "stock": stock,
        },
    )


async def sync_existing_inventory(client: AsyncOpenSearch, pool: asyncpg.Pool) -> None:
    rows = await pool.fetch(
        """SELECT product_id, city, stock FROM store_inventory ORDER BY product_id, city"""
    )
    for row in rows:
        await upsert_product(
            client, pool, row["product_id"], row["city"], row["stock"]
        )
    print(f"Indexed inventory rows: {len(rows)}")


async def is_processed(pool: asyncpg.Pool, event_id: int) -> bool:
    return await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM processed_events WHERE consumer = $1 AND event_id = $2)",
        CONSUMER_NAME,
        event_id,
    )


async def process_message(
    message, client: AsyncOpenSearch, pool: asyncpg.Pool
) -> None:
    payload = message.value
    event_id = payload.get("outbox_event_id")
    if event_id is not None and await is_processed(pool, event_id):
        return

    if message.topic == "inventory.changed":
        await upsert_product(
            client,
            pool,
            int(payload["product_id"]),
            str(payload["city"]),
            int(payload["stock"]),
        )
    elif message.topic == "order.placed":
        city = str(payload["city"])
        for item in payload.get("items", []):
            product_id = int(item["product_id"])
            stock = await pool.fetchval(
                "SELECT stock FROM store_inventory WHERE product_id = $1 AND city = $2",
                product_id,
                city,
            )
            if stock is not None:
                await upsert_product(client, pool, product_id, city, stock)
    else:
        raise ValueError(f"Unexpected Kafka topic: {message.topic}")

    if event_id is not None:
        await pool.execute(
            """INSERT INTO processed_events (consumer, event_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING""",
            CONSUMER_NAME,
            event_id,
        )


async def main() -> None:
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(PG_DSN, min_size=1, max_size=4)
    client = create_client()
    consumer = AIOKafkaConsumer(
        "inventory.changed",
        "order.placed",
        **kafka_client_options(),
        group_id=CONSUMER_NAME,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )
    try:
        await ensure_index(client)
        await sync_existing_inventory(client, pool)
        await consumer.start()
        print("Search-sync consumer started")
        async for message in consumer:
            await process_message(message, client, pool)
            await consumer.commit()
    finally:
        await consumer.stop()
        await client.close()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
