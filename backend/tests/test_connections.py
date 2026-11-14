import os
import unittest
from unittest.mock import patch

from app.connections import postgres_connection_kwargs


class PostgresConnectionTests(unittest.TestCase):
    def test_password_is_passed_raw_outside_the_connection_uri(self):
        password = "p@ss:/?#%&=+"
        with patch.dict(os.environ, {"PG_PASSWORD": password}, clear=True):
            self.assertEqual(postgres_connection_kwargs(), {"password": password})

    def test_missing_password_does_not_override_uri_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(postgres_connection_kwargs(), {})


if __name__ == "__main__":
    unittest.main()
