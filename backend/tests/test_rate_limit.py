"""Rate limit tests for the checkout endpoint.

Verifies that slowapi enforces the configured request limit and returns
429 with a Retry-After header when the limit is exceeded.
"""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import create_app


@unittest.skipUnless(
    os.getenv("TEST_RATE_LIMIT"), "set TEST_RATE_LIMIT=1 to run rate limit tests"
)
class RateLimitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)

    def test_checkout_rate_limit_returns_429(self):
        """6 requests to /checkout within the window; the 6th gets 429."""
        statuses = []
        for _ in range(6):
            r = self.client.post(
                "/api/checkout",
                json={
                    "customer_email": "rate-limit@example.com",
                    "customer_name": "Rate Limit Tester",
                    "city": "Bengaluru",
                    "cart_id": None,
                    "items": [],
                },
            )
            statuses.append(r.status_code)

        # First 5 may fail for other reasons (no DB, no cart secret), but
        # none should be 429. The 6th must be rate-limited.
        self.assertNotIn(429, statuses[:5], "rate limit tripped too early")
        self.assertEqual(
            statuses[5], 429, "6th request to /checkout should return 429"
        )

    def test_429_includes_retry_after(self):
        """The 429 response must include a Retry-After header."""
        # Exhaust the limit first
        for _ in range(6):
            self.client.post(
                "/api/checkout",
                json={
                    "customer_email": "retry-after@example.com",
                    "customer_name": "Retry After Tester",
                    "city": "Mumbai",
                    "cart_id": None,
                    "items": [],
                },
            )

        r = self.client.post(
            "/api/checkout",
            json={
                "customer_email": "retry-after@example.com",
                "customer_name": "Retry After Tester",
                "city": "Mumbai",
                "cart_id": None,
                "items": [],
            },
        )
        self.assertEqual(r.status_code, 429)
        self.assertIn("retry-after", r.headers)
