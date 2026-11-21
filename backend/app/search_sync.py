import asyncio
import os

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv
from opensearchpy._async.client import AsyncOpenSearch
from opensearchpy.exceptions import NotFoundError

from app.connections import (
    PROJECT_ROOT,
    create_opensearch_client,
    kafka_client_options,
    postgres_connection_kwargs,
)
from app.resilience import configure_logging, handle_with_retry, safe_json_loads

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
CONSUMER_NAME = "search-sync"
INDEX_NAME = "products"


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
            index=INDEX_NAME, id=f"{product_id}:{city}"
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
        """SELECT product_id, city FROM store_inventory ORDER BY product_id, city"""
    )
    for row in rows:
        await sync_stock_from_database(
            client, pool, row["product_id"], row["city"]
        )
    print(f"Indexed inventory rows: {len(rows)}")
    await client.indices.refresh(index=INDEX_NAME)


async def is_processed(pool: asyncpg.Pool, event_id: int) -> bool:
    return await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM processed_events WHERE consumer = $1 AND event_id = $2)",
        CONSUMER_NAME,
        event_id,
    )


async def sync_stock_from_database(
    client: AsyncOpenSearch,
    pool: asyncpg.Pool,
    product_id: int,
    city: str,
) -> None:
    """Index the stock currently stored in Postgres.

    Inventory events carry the stock from the moment they were written. They are
    not ordered against order events, so applying that payload can put a sold
    unit back into search. Postgres is the source of truth.
    """
    async with pool.acquire() as conn:
        lock_id = await conn.fetchval(
            "SELECT hashtextextended($1, $2)", city, product_id
        )
        await conn.fetchval("SELECT pg_advisory_lock($1)", lock_id)
        try:
            stock = await conn.fetchval(
                "SELECT stock FROM store_inventory WHERE product_id = $1 AND city = $2",
                product_id,
                city,
            )
            if stock is None or stock <= 0:
                await delete_product(client, product_id, city)
                return
            product = await conn.fetchrow(
                """SELECT id, sku, name, description, category, price_paise, image_url
                   FROM products WHERE id = $1""",
                product_id,
            )
            if product is None:
                return
            await index_product(client, product, city, stock)
        finally:
            await conn.fetchval("SELECT pg_advisory_unlock($1)", lock_id)


async def index_product(
    client: AsyncOpenSearch, product, city: str, stock: int
) -> None:
    await client.index(
        index=INDEX_NAME,
        id=f"{product['id']}:{city}",
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


async def process_message(
    message, client: AsyncOpenSearch, pool: asyncpg.Pool
) -> None:
    payload = message.value
    if payload.get("_malformed"):
        raise ValueError("malformed Kafka message")
    event_id = payload.get("outbox_event_id")
    if event_id is not None and await is_processed(pool, event_id):
        return

    if message.topic == "inventory.changed":
        await sync_stock_from_database(
            client,
            pool,
            int(payload["product_id"]),
            str(payload["city"]),
        )
    elif message.topic == "order.placed":
        city = str(payload["city"])
        for item in payload.get("items", []):
            await sync_stock_from_database(
                client, pool, int(item["product_id"]), city
            )
    else:
        raise ValueError(f"Unexpected Kafka topic: {message.topic}")

    if event_id is not None:
        await pool.execute(
            """INSERT INTO processed_events (consumer, event_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING""",
            CONSUMER_NAME,
            event_id,
        )
        await pool.execute(
            """UPDATE outbox_events SET consumer_status = 'synced' WHERE id = $1""",
            event_id,
        )


async def main() -> None:
    configure_logging()
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=4, **postgres_connection_kwargs()
    )
    client = create_opensearch_client()
    consumer = AIOKafkaConsumer(
        "inventory.changed",
        "order.placed",
        **kafka_client_options(),
        group_id=CONSUMER_NAME,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=safe_json_loads,
    )
    try:
        await ensure_index(client)
        await sync_existing_inventory(client, pool)
        await consumer.start()
        print("Search-sync consumer started")
        async for message in consumer:
            await handle_with_retry(
                message, lambda m: process_message(m, client, pool), pool, CONSUMER_NAME
            )
            await consumer.commit()
    finally:
        await consumer.stop()
        await client.close()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
