import ipaddress
import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, Request, Response

from app.main import (
    CheckoutIn,
    checkout,
    create_app,
    get_client_address,
    get_order,
    hash_order_access_token,
    require_admin_key,
)


class ClientAddressTests(unittest.TestCase):
    def make_request(self, peer: str, forwarded_for: str = "") -> Request:
        headers = [(b"x-forwarded-for", forwarded_for.encode())] if forwarded_for else []
        return Request(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/checkout",
                "raw_path": b"/checkout",
                "query_string": b"",
                "headers": headers,
                "client": (peer, 1234),
                "server": ("127.0.0.1", 8000),
            }
        )

    def test_ignores_forwarded_address_from_untrusted_peer(self):
        with patch("app.main.trusted_proxy_networks", ()):
            address = get_client_address(self.make_request("203.0.113.10", "198.51.100.5"))

        self.assertEqual(address, "203.0.113.10")

    def test_uses_client_address_forwarded_by_trusted_proxy(self):
        trusted_proxy = ipaddress.ip_network("10.0.0.0/8")
        with patch("app.main.trusted_proxy_networks", (trusted_proxy,)):
            address = get_client_address(
                self.make_request("10.0.0.2", "198.51.100.5, 10.0.0.1")
            )

        self.assertEqual(address, "198.51.100.5")


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


class ApiDocsTests(unittest.TestCase):
    def test_api_docs_are_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            app = create_app()

        self.assertIsNone(app.docs_url)
        self.assertIsNone(app.redoc_url)
        self.assertIsNone(app.openapi_url)

    def test_api_docs_can_be_enabled_explicitly(self):
        with patch.dict(os.environ, {"API_DOCS_ENABLED": "true"}, clear=True):
            app = create_app()

        self.assertEqual(app.docs_url, "/docs")
        self.assertEqual(app.redoc_url, "/redoc")
        self.assertEqual(app.openapi_url, "/openapi.json")


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
            scope = {
                "type": "http",
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/checkout",
                "raw_path": b"/checkout",
                "query_string": b"",
                "headers": [],
                "client": ("127.0.0.1", 1234),
                "server": ("127.0.0.1", 8000),
            }
            result = await checkout.__wrapped__(Request(scope), Response(), request)

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
