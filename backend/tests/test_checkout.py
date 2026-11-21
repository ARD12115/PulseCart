"""Unit tests for checkout business logic."""

import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import asyncpg

from app.checkout import OutOfStock, UnknownProduct, place_order


class FakeConnection:
    def __init__(self, stock: int = 10, product_exists: bool = True, price_paise: int = 1000):
        self.stock = stock
        self.product_exists = product_exists
        self.price_paise = price_paise
        self.executed_queries: list[tuple] = []
        self.transaction_entered = False
        self.transaction_committed = False
        self.transaction_rolled_back = False

    async def fetchrow(self, query: str, *args):
        self.executed_queries.append(("fetchrow", query, args))
        if "UPDATE store_inventory" in query:
            if self.stock >= args[2]:
                    return {"stock": self.stock - args[2]}
            return None
        if "SELECT 1 FROM products" in query:
                return {"1": 1} if self.product_exists else None
        if "INSERT INTO orders" in query:
                return {"id": 42}
        return None

    async def fetchval(self, query: str, *args):
        self.executed_queries.append(("fetchval", query, args))
                if "INSERT INTO orders" in query:
                    return 42
        if "SELECT price_paise FROM products" in query:
            return self.price_paise if self.product_exists else None
        if "SELECT 1 FROM products" in query:
            return 1 if self.product_exists else None
        if "SELECT 1 FROM carts" in query:
            return 1
        return None

    async def execute(self, query: str, *args):
        self.executed_queries.append(("execute", query, args))
        return "INSERT 0 1"

    def transaction(self):
        return FakeTransaction(self)

    async def __aenter__(self):
        self.transaction_entered = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.transaction_rolled_back = True
        else:
            self.transaction_committed = True
        return False


class FakeTransaction:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    async def __aenter__(self):
        self.connection.transaction_entered = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.connection.transaction_rolled_back = True
        else:
            self.connection.transaction_committed = True
        return False


class FakePool:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    def acquire(self):
        return FakeAcquire(self.connection)


class FakeAcquire:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False


class PlaceOrderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.access_token_expires_at = datetime.now(timezone.utc) + timedelta(days=90)

    async def test_place_order_success(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        order_id = await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 2)],
            access_token_hash="hash123",
            access_token_expires_at=self.access_token_expires_at,
        )

        self.assertEqual(order_id, 42)
        self.assertTrue(conn.transaction_committed)
        self.assertFalse(conn.transaction_rolled_back)

        # Verify stock was decremented
        update_queries = [q for q in conn.executed_queries if q[0] == "fetchrow" and "UPDATE store_inventory" in q[1]]
        self.assertEqual(len(update_queries), 1)
        self.assertEqual(update_queries[0][2], (1, "Bengaluru", 2))

    async def test_place_order_out_of_stock(self):
        conn = FakeConnection(stock=1, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        with self.assertRaises(OutOfStock) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(1, 2)],
                access_token_hash="hash123",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertEqual(cm.exception.product_id, 1)
        self.assertTrue(conn.transaction_rolled_back)

    async def test_place_order_unknown_product(self):
        conn = FakeConnection(stock=10, product_exists=False, price_paise=2500)
        pool = FakePool(conn)

        with self.assertRaises(UnknownProduct) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(999, 1)],
                access_token_hash="hash123",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertEqual(cm.exception.product_id, 999)
        self.assertTrue(conn.transaction_rolled_back)

    async def test_place_order_multiple_items(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        order_id = await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 2), (2, 1), (3, 3)],
            access_token_hash="hash123",
            access_token_expires_at=self.access_token_expires_at,
        )

        self.assertEqual(order_id, 42)
        # Should have 3 inventory updates
        update_queries = [q for q in conn.executed_queries if q[0] == "fetchrow" and "UPDATE store_inventory" in q[1]]
        self.assertEqual(len(update_queries), 3)

    async def test_place_order_with_idempotency_key(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        order_id = await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 1)],
            access_token_hash="hash123",
            idempotency_key="idem-key-123",
            access_token_expires_at=self.access_token_expires_at,
        )

        self.assertEqual(order_id, 42)
        # Check that idempotency_key was passed to INSERT
        insert_queries = [q for q in conn.executed_queries if q[0] == "fetchrow" and "INSERT INTO orders" in q[1]]
        self.assertEqual(len(insert_queries), 1)
        self.assertIn("idem-key-123", str(insert_queries[0][2]))

    async def test_place_order_with_cart(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)
        cart_id = UUID("12345678-1234-5678-1234-567812345678")
        cart_secret = "secret123"

        order_id = await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 1)],
            access_token_hash="hash123",
            cart_id=cart_id,
            cart_secret=cart_secret,
            access_token_expires_at=self.access_token_expires_at,
        )

        self.assertEqual(order_id, 42)
        # Check cart verification and deletion
        cart_queries = [q for q in conn.executed_queries if "carts" in q[1] or "cart_items" in q[1]]
        self.assertTrue(any("SELECT 1 FROM carts" in q[1] for q in cart_queries))
        self.assertTrue(any("DELETE FROM cart_items" in q[1] for q in cart_queries))

    async def test_place_order_invalid_cart_secret(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        # Override fetchval to return None for cart verification
        original_fetchval = conn.fetchval

        async def mock_fetchval(query: str, *args):
            if "SELECT 1 FROM carts" in query:
                return None
            return await original_fetchval(query, *args)

        conn.fetchval = mock_fetchval
        pool = FakePool(conn)
        cart_id = UUID("12345678-1234-5678-1234-567812345678")

        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(1, 1)],
                access_token_hash="hash123",
                cart_id=cart_id,
                cart_secret="wrong_secret",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertEqual(cm.exception.status_code, 401)
        self.assertEqual(cm.exception.detail, "Invalid cart secret for this cart")

    async def test_place_order_missing_cart_secret(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)
        cart_id = UUID("12345678-1234-5678-1234-567812345678")

        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(1, 1)],
                access_token_hash="hash123",
                cart_id=cart_id,
                cart_secret=None,
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertEqual(cm.exception.status_code, 401)
        self.assertEqual(cm.exception.detail, "Cart secret required to check out this cart")

    async def test_place_order_negative_quantity_raises(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        with self.assertRaises(ValueError) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(1, -1)],
                access_token_hash="hash123",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertIn("positive", str(cm.exception))

    async def test_place_order_zero_quantity_raises(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        with self.assertRaises(ValueError) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[(1, 0)],
                access_token_hash="hash123",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertIn("positive", str(cm.exception))

    async def test_place_order_empty_items_raises(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        with self.assertRaises(ValueError) as cm:
            await place_order(
                pool,
                customer_id=1,
                city="Bengaluru",
                items=[],
                access_token_hash="hash123",
                access_token_expires_at=self.access_token_expires_at,
            )

        self.assertIn("at least one item", str(cm.exception))

    async def test_place_order_duplicate_product_ids_combined(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        order_id = await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 2), (1, 3)],  # Same product ID twice
            access_token_hash="hash123",
            access_token_expires_at=self.access_token_expires_at,
        )

        self.assertEqual(order_id, 42)
        # Should only have one inventory update for product 1 with qty=5
        update_queries = [q for q in conn.executed_queries if q[0] == "fetchrow" and "UPDATE store_inventory" in q[1]]
        self.assertEqual(len(update_queries), 1)
        self.assertEqual(update_queries[0][2], (1, "Bengaluru", 5))

    async def test_place_order_creates_outbox_events(self):
        conn = FakeConnection(stock=10, product_exists=True, price_paise=2500)
        pool = FakePool(conn)

        await place_order(
            pool,
            customer_id=1,
            city="Bengaluru",
            items=[(1, 1)],
            access_token_hash="hash123",
            access_token_expires_at=self.access_token_expires_at,
        )

        # Check that outbox events were written
        outbox_queries = [q for q in conn.executed_queries if q[0] == "execute" and "outbox_events" in q[1]]
        self.assertEqual(len(outbox_queries), 2)  # order.placed + inventory.changed

        # Verify topics
        topics = [q[2][0] for q in outbox_queries]
        self.assertIn("order.placed", topics)
        self.assertIn("inventory.changed", topics)


if __name__ == "__main__":
    unittest.main()