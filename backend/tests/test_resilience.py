import unittest
from types import SimpleNamespace

from app.resilience import handle_with_retry, safe_json_loads


class RecordingPool:
    def __init__(self):
        self.executed: list[tuple] = []

    async def execute(self, query: str, *args):
        self.executed.append(args)


def make_message(value: dict | None = None):
    return SimpleNamespace(
        topic="order.placed",
        partition=0,
        offset=7,
        key=b"42",
        value=value if value is not None else {"order_id": 42},
    )


class SafeJsonTests(unittest.TestCase):
    def test_valid_object_is_returned(self):
        self.assertEqual(safe_json_loads(b'{"order_id": 1}'), {"order_id": 1})

    def test_garbage_becomes_a_marker_instead_of_raising(self):
        result = safe_json_loads(b"not json \xff")

        self.assertTrue(result["_malformed"])

    def test_non_object_json_is_marked_malformed(self):
        self.assertTrue(safe_json_loads(b"[1, 2]")["_malformed"])
        self.assertTrue(safe_json_loads(None)["_malformed"])


class HandleWithRetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_after_transient_failures_is_not_dead_lettered(self):
        pool = RecordingPool()
        calls = 0

        async def flaky(message):
            nonlocal calls
            calls += 1
            if calls < 3:
                raise RuntimeError("temporary")

        ok = await handle_with_retry(make_message(), flaky, pool, "c", base_delay=0)

        self.assertTrue(ok)
        self.assertEqual(calls, 3)
        self.assertEqual(pool.executed, [])

    async def test_persistent_failure_is_recorded_and_skipped(self):
        pool = RecordingPool()

        async def always_fails(message):
            raise ValueError("poison")

        ok = await handle_with_retry(
            make_message(), always_fails, pool, "search-sync", attempts=2, base_delay=0
        )

        self.assertFalse(ok)
        self.assertEqual(len(pool.executed), 1)
        consumer, topic, partition, offset, key, _value, error = pool.executed[0]
        self.assertEqual((consumer, topic, partition, offset, key), ("search-sync", "order.placed", 0, 7, "42"))
        self.assertIn("ValueError: poison", error)

    async def test_dead_letter_write_failure_propagates_so_the_message_is_redelivered(self):
        class BrokenPool:
            async def execute(self, *args):
                raise ConnectionError("database down")

        async def always_fails(message):
            raise ValueError("poison")

        with self.assertRaises(ConnectionError):
            await handle_with_retry(
                make_message(), always_fails, BrokenPool(), "c", attempts=1, base_delay=0
            )


if __name__ == "__main__":
    unittest.main()
