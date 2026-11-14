import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.main import (
    CheckoutIn,
    checkout,
    get_order,
    hash_order_access_token,
    require_admin_key,
)


class FakeConnection:
    def __init__(self, order: dict | None = None):
        self.order = order
        self.fetchrow_args: tuple | None = None

    async def fetchrow(self, query: str, *args):
        self.fetchrow_args = args
        return self.order

    async def fetch(self, query: str, *args):
        return [{"product_id": 1, "qty": 2}]


class FakeAcquire:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False


class FakePool:
    def __init__(self, connection: FakeConnection):
        self.connection = connection

    def acquire(self):
        return FakeAcquire(self.connection)


class CheckoutConnection:
    async def fetchval(self, query: str, *args):
        return 9


class CheckoutPool:
    def __init__(self):
        self.connection = CheckoutConnection()

    def acquire(self):
        return FakeAcquire(self.connection)

    async def fetchrow(self, query: str, *args):
        return {"total_paise": 1250, "status": "placed"}


class AdminAccessTests(unittest.TestCase):
    def test_admin_is_closed_when_key_and_environment_are_unset(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as error:
                require_admin_key()

        self.assertEqual(error.exception.status_code, 503)

    def test_admin_is_open_only_in_explicit_development_without_key(self):
        with patch.dict(os.environ, {"APP_ENV": "development"}, clear=True):
            require_admin_key()

    def test_configured_admin_key_must_match(self):
        with patch.dict(
            os.environ, {"APP_ENV": "production", "ADMIN_KEY": "test-key"}, clear=True
        ):
            require_admin_key("test-key")
            with self.assertRaises(HTTPException) as error:
                require_admin_key("wrong-key")

        self.assertEqual(error.exception.status_code, 401)


class OrderAccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_checkout_returns_token_and_persists_only_its_hash(self):
        token = "new-order-access-token"
        request = CheckoutIn(
            customer_email="buyer@example.com",
            customer_name="Buyer",
            city="Bengaluru",
            items=[{"product_id": 1, "qty": 1}],
        )
        with (
            patch("app.main.db_pool", return_value=CheckoutPool()),
            patch("app.main.secrets.token_urlsafe", return_value=token),
            patch("app.main.place_order", new_callable=AsyncMock, return_value=42) as place,
        ):
            result = await checkout(request)

        self.assertEqual(result["order_access_token"], token)
        self.assertEqual(place.await_args.args[-1], hash_order_access_token(token))
        self.assertNotEqual(place.await_args.args[-1], token)

    async def test_order_lookup_requires_a_token(self):
        with self.assertRaises(HTTPException) as error:
            await get_order(42)

        self.assertEqual(error.exception.status_code, 401)

    async def test_order_lookup_uses_only_the_token_hash(self):
        token = "customer-order-token"
        connection = FakeConnection(
            {
                "id": 42,
                "city": "Bengaluru",
                "status": "placed",
                "total_paise": 1000,
                "created_at": "now",
            }
        )
        with patch("app.main.db_pool", return_value=FakePool(connection)):
            result = await get_order(42, token)

        self.assertEqual(connection.fetchrow_args, (42, hash_order_access_token(token)))
        self.assertNotIn(token, connection.fetchrow_args)
        self.assertEqual(result["order"]["id"], 42)
        self.assertEqual(result["items"][0]["product_id"], 1)

    async def test_order_lookup_rejects_an_invalid_token(self):
        connection = FakeConnection()
        with patch("app.main.db_pool", return_value=FakePool(connection)):
            with self.assertRaises(HTTPException) as error:
                await get_order(42, "wrong-token")

        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
