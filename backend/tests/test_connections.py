import os
import unittest
from unittest.mock import patch

from app.connections import postgres_connection_kwargs, postgres_pool_limits


class PostgresConnectionTests(unittest.TestCase):
    def test_pool_defaults_to_one_connection_per_instance(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(postgres_pool_limits(), {"min_size": 1, "max_size": 1})

    def test_pool_limits_can_be_configured(self):
        with patch.dict(
            os.environ,
            {"PG_POOL_MIN_SIZE": "1", "PG_POOL_MAX_SIZE": "3"},
            clear=True,
        ):
            self.assertEqual(postgres_pool_limits(), {"min_size": 1, "max_size": 3})

    def test_password_is_passed_raw_outside_the_connection_uri(self):
        password = "p@ss:/?#%&=+"
        with patch.dict(os.environ, {"PG_PASSWORD": password}, clear=True):
            self.assertEqual(postgres_connection_kwargs(), {"password": password})

    def test_missing_password_does_not_override_uri_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(postgres_connection_kwargs(), {})


if __name__ == "__main__":
    unittest.main()
