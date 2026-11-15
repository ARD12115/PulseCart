"""Integration tests against a real PostgreSQL database.

Skipped unless TEST_PG_DSN is set. Use a DISPOSABLE database that already has db/schema.sql
applied, for example:

    TEST_PG_DSN=postgresql://postgres:postgres@localhost:5432/pulsecart python -m unittest tests.test_postgres_integration

The tests create their own product and customer rows, but test_relay marks every unpublished
outbox event as published, so never point this at data you care about.
"""

import asyncio
import os
import unittest
import uuid
from types import SimpleNamespace

import asyncpg

from app.checkout import place_order
from app.notification import create_notification, send_pending
from app.outbox_relay import publish_batch
from app.resilience import handle_with_retry

DSN = os.getenv("TEST_PG_DSN")


@unittest.skipUnless(DSN, "set TEST_PG_DSN to run PostgreSQL integration tests")
class PostgresIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(DSN, min_size=1, max_size=6)
        suffix = uuid.uuid4().hex[:10]
        self.city = f"TestCity-{suffix}"
        self.product_id = await self.pool.fetchval(
            """INSERT INTO products (sku, name, category, price_paise)
               VALUES ($1, 'Integration Widget', 'test', 1500) RETURNING id""",
            f"IT-{suffix}",
        )
        await self.pool.execute(
            "INSERT INTO store_inventory (product_id, city, stock) VALUES ($1, $2, 5)",
            self.product_id,
            self.city,
        )
        self.customer_id = await self.pool.fetchval(
            "INSERT INTO customers (email, name, city) VALUES ($1, 'Tester', $2) RETURNING id",
            f"it-{suffix}@example.com",
            self.city,
        )

    async def asyncTearDown(self):
        await self.pool.close()

    async def stock(self) -> int:
        return await self.pool.fetchval(
            "SELECT stock FROM store_inventory WHERE product_id = $1 AND city = $2",
            self.product_id,
            self.city,
        )

    async def order(self, **kwargs) -> int:
        return await place_order(
            self.pool, self.customer_id, self.city, [(self.product_id, 1)], "hash", **kwargs
        )

    async def test_same_idempotency_key_creates_one_order_and_one_decrement(self):
        results = await asyncio.gather(
            self.order(idempotency_key="key-12345678"),
            self.order(idempotency_key="key-12345678"),
            return_exceptions=True,
        )

        winners = [r for r in results if isinstance(r, int)]
        losers = [r for r in results if isinstance(r, asyncpg.UniqueViolationError)]
        self.assertEqual((len(winners), len(losers)), (1, 1))
        self.assertEqual(await self.stock(), 4)
        count = await self.pool.fetchval(
            "SELECT count(*) FROM orders WHERE customer_id = $1", self.customer_id
        )
        self.assertEqual(count, 1)

    async def test_orders_without_a_key_are_independent(self):
        await self.order()
        await self.order()

        self.assertEqual(await self.stock(), 3)

    async def test_cart_is_emptied_in_the_same_transaction_as_the_order(self):
        cart_id = await self.pool.fetchval("INSERT INTO carts DEFAULT VALUES RETURNING id")
        await self.pool.execute(
            "INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, 1)",
            cart_id,
            self.product_id,
        )

        await self.order(cart_id=cart_id)

        remaining = await self.pool.fetchval(
            "SELECT count(*) FROM cart_items WHERE cart_id = $1", cart_id
        )
        self.assertEqual(remaining, 0)

    async def test_failed_order_does_not_empty_the_cart(self):
        cart_id = await self.pool.fetchval("INSERT INTO carts DEFAULT VALUES RETURNING id")
        await self.pool.execute(
            "INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, 1)",
            cart_id,
            self.product_id,
        )

        with self.assertRaises(Exception):
            await place_order(
                self.pool, self.customer_id, self.city, [(self.product_id, 99)], "hash",
                cart_id=cart_id,
            )

        remaining = await self.pool.fetchval(
            "SELECT count(*) FROM cart_items WHERE cart_id = $1", cart_id
        )
        self.assertEqual(remaining, 1)

    async def test_relay_marks_sent_events_even_when_kafka_fails_midway(self):
        await self.pool.execute(
            "UPDATE outbox_events SET published_at = now() WHERE published_at IS NULL"
        )
        prefix = f"relay-{uuid.uuid4().hex[:8]}-"  # unique per run so reruns do not collide
        for number in range(3):
            await self.pool.execute(
                "INSERT INTO outbox_events (topic, key, payload) VALUES ('t', $1, '{}'::jsonb)",
                f"{prefix}{number}",
            )

        class FlakyProducer:
            def __init__(self):
                self.sent = []

            async def send_and_wait(self, topic, key, value):
                if len(self.sent) == 1:
                    raise ConnectionError("broker gone")
                self.sent.append(key)

        producer = FlakyProducer()
        with self.assertRaises(ConnectionError):
            await publish_batch(self.pool, producer)

        published = await self.pool.fetchval(
            "SELECT count(*) FROM outbox_events WHERE published_at IS NOT NULL AND key LIKE $1",
            prefix + "%",
        )
        self.assertEqual(published, 1)  # only the event that really reached Kafka

        class GoodProducer:
            def __init__(self):
                self.sent = []

            async def send_and_wait(self, topic, key, value):
                self.sent.append(key)

        good = GoodProducer()
        self.assertEqual(await publish_batch(self.pool, good), 2)
        self.assertEqual(sorted(good.sent), [f"{prefix}1".encode(), f"{prefix}2".encode()])

    async def test_notification_is_created_once_even_if_the_event_is_redelivered(self):
        order_id = await self.order()
        event_id = int(uuid.uuid4().int % 10**9)
        message = SimpleNamespace(
            topic="order.placed",
            value={
                "order_id": order_id,
                "customer_id": self.customer_id,
                "city": self.city,
                "total_paise": 1500,
                "outbox_event_id": event_id,
            },
        )

        await create_notification(message, self.pool)
        await create_notification(message, self.pool)

        rows = await self.pool.fetch("SELECT * FROM notifications WHERE order_id = $1", order_id)
        self.assertEqual(len(rows), 1)
        self.assertIn("Integration Widget", rows[0]["body"])
        self.assertEqual(rows[0]["status"], "pending")

        async def fake_send(row):
            return "logged"

        await send_pending(self.pool, fake_send)
        status = await self.pool.fetchval(
            "SELECT status FROM notifications WHERE order_id = $1", order_id
        )
        self.assertEqual(status, "logged")

    async def test_failing_delivery_is_retried_then_marked_failed(self):
        order_id = await self.order()
        await create_notification(
            SimpleNamespace(
                topic="order.placed",
                value={"order_id": order_id, "customer_id": self.customer_id, "city": self.city,
                       "total_paise": 1500},
            ),
            self.pool,
        )

        async def broken_send(row):
            raise ConnectionError("smtp down")

        for _ in range(5):
            await send_pending(self.pool, broken_send)

        row = await self.pool.fetchrow(
            "SELECT status, attempts, last_error FROM notifications WHERE order_id = $1", order_id
        )
        self.assertEqual((row["status"], row["attempts"]), ("failed", 5))
        self.assertIn("smtp down", row["last_error"])

    async def test_poison_message_lands_in_dead_letters(self):
        message = SimpleNamespace(
            topic="order.placed", partition=0, offset=123456, key=b"x", value={"_malformed": True}
        )

        ok = await handle_with_retry(
            message, lambda m: create_notification(m, self.pool), self.pool,
            f"it-{self.city}", base_delay=0,
        )

        self.assertFalse(ok)
        count = await self.pool.fetchval(
            "SELECT count(*) FROM dead_letter_events WHERE consumer = $1", f"it-{self.city}"
        )
        self.assertEqual(count, 1)


if __name__ == "__main__":
    unittest.main()
