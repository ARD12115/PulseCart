"""Check that PostgreSQL, Kafka and OpenSearch are reachable and set up.

    cd backend && python -m app.preflight

Run it against your Aiven services before a demo. It reads the same .env as the app and
exits non-zero if anything is wrong.
"""

import asyncio
import os
import sys

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv

from app.connections import (
    PROJECT_ROOT,
    create_opensearch_client,
    kafka_client_options,
    postgres_connection_kwargs,
)

load_dotenv(PROJECT_ROOT / ".env")

REQUIRED_TABLES = {
    "products", "store_inventory", "customers", "orders", "order_items",
    "outbox_events", "processed_events", "carts", "cart_items", "notifications",
    "dead_letter_events",
}
REQUIRED_TOPICS = {"order.placed", "inventory.changed"}


async def check_postgres() -> str:
    dsn = os.getenv("PG_DSN")
    if not dsn:
        raise RuntimeError("PG_DSN is not set")
    conn = await asyncpg.connect(dsn, timeout=10, **postgres_connection_kwargs())
    try:
        tables = {
            row["tablename"]
            for row in await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        }
        missing = REQUIRED_TABLES - tables
        if missing:
            raise RuntimeError(f"missing tables {sorted(missing)}: apply db/schema.sql")
        products = await conn.fetchval("SELECT count(*) FROM products")
        if not products:
            raise RuntimeError("no products: run `python -m app.seed`")
        return f"{products} products"
    finally:
        await conn.close()


async def check_kafka() -> str:
    consumer = AIOKafkaConsumer(**kafka_client_options())
    try:
        await asyncio.wait_for(consumer.start(), timeout=15)
        topics = await consumer.topics()
    finally:
        await consumer.stop()
    missing = REQUIRED_TOPICS - set(topics)
    if missing:
        raise RuntimeError(f"missing topics {sorted(missing)}: create them in the Aiven console")
    return "topics " + ", ".join(sorted(REQUIRED_TOPICS))


async def check_opensearch() -> str:
    client = create_opensearch_client()
    try:
        health = await client.cluster.health()
        if not await client.indices.exists(index="products"):
            raise RuntimeError("index 'products' not found: start the search-sync worker")
        count = (await client.count(index="products"))["count"]
        if not count:
            raise RuntimeError("index 'products' is empty: wait for search-sync to finish")
        return f"cluster {health.get('status')}, {count} indexed documents"
    finally:
        await client.close()


async def main() -> int:
    failures = 0
    for name, check in (
        ("PostgreSQL", check_postgres),
        ("Kafka", check_kafka),
        ("OpenSearch", check_opensearch),
    ):
        try:
            print(f"PASS  {name}: {await check()}")
        except Exception as exc:
            failures += 1
            print(f"FAIL  {name}: {type(exc).__name__}: {exc}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
