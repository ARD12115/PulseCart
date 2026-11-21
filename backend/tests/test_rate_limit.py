"""Rate limit tests for the checkout endpoint.

Verifies that slowapi enforces the configured request limit and returns
429 with a Retry-After header when the limit is exceeded.
"""

import os
import unittest
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient

from app.main import create_app


class FakeConn:
    """Fake asyncpg connection that returns a customer id on fetchval."""

    def __init__(self):
        self._first = True

    async def fetchval(self, query, *args):
        if self._first:
            self._first = False
            return 9  # new customer id
        return 9  # existing customer id on conflict path

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class FakePool:
    def acquire(self):
        return FakeConn()

    async def fetchrow(self, query, *args):
        return {"total_paise": 1250, "status": "placed"}


class RateLimitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)

    def test_checkout_rate_limit_returns_429(self):
        """6 requests to /checkout within the window; the 6th gets 429."""
        with (
            patch("app.main.db_pool", return_value=FakePool()),
            patch(
                "app.checkout.place_order",
                new_callable=AsyncMock,
                return_value=42,
            ) as mock_place_order,
        ):
            statuses = []
            for _ in range(6):
                r = self.client.post(
                    "/api/checkout",
                    json={
                        "customer_email": "rate-limit@example.com",
                        "customer_name": "Rate Limit Tester",
                        "city": "Bengaluru",
                        "cart_id": None,
                        "items": [{"product_id": 1, "qty": 1}],
                    },
                )
                statuses.append(r.status_code)

            # First 5 should succeed (200), 6th should be rate-limited (429).
            self.assertEqual(
                statuses[:5], [200] * 5, "first 5 requests should succeed"
            )
            self.assertEqual(
                statuses[5], 429, "6th request to /checkout should return 429"
            )

    def test_429_includes_retry_after(self):
        """The 429 response must include a Retry-After header."""
        with (
            patch("app.main.db_pool", return_value=FakePool()),
            patch(
                "app.checkout.place_order",
                new_callable=AsyncMock,
                return_value=42,
            ),
        ):
            for _ in range(6):
                self.client.post(
                    "/api/checkout",
                    json={
                        "customer_email": "retry-after@example.com",
                        "customer_name": "Retry After Tester",
                        "city": "Mumbai",
                        "cart_id": None,
                        "items": [{"product_id": 1, "qty": 1}],
                    },
                )

        r = self.client.post(
            "/api/checkout",
            json={
                "customer_email": "retry-after@example.com",
                "customer_name": "Retry After Tester",
                "city": "Mumbai",
                "cart_id": None,
                "items": [{"product_id": 1, "qty": 1}],
            },
        )
        self.assertEqual(r.status_code, 429)
        self.assertIn("retry-after", r.headers)
