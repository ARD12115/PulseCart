import asyncio
import unittest
from types import SimpleNamespace

from app.search_sync import process_message, sync_stock_from_database


class FakeAcquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False


class RecordingClient:
    def __init__(self):
        self.indexed: dict | None = None
        self.deleted: list[str] = []
        self.operations: list[str] = []

    async def index(self, **kwargs):
        self.indexed = kwargs
        self.operations.append("index")

    async def delete(self, **kwargs):
        self.deleted.append(kwargs["id"])
        self.operations.append("delete")


class BlockingIndexClient(RecordingClient):
    def __init__(self):
        super().__init__()
        self.index_started = asyncio.Event()
        self.allow_index = asyncio.Event()

    async def index(self, **kwargs):
        self.index_started.set()
        await self.allow_index.wait()
        await super().index(**kwargs)


class InventoryPool:
    def __init__(self, stock: int | None):
        self.stock = stock
        self.advisory_lock = asyncio.Lock()
        self.product = {
            "id": 1,
            "sku": "ELE-HEADPHONES",
            "name": "Bluetooth Headphones",
            "description": "Wireless over-ear headphones",
            "category": "electronics",
            "price_paise": 249900,
            "image_url": None,
        }

    async def fetchval(self, query: str, *args):
        if "processed_events" in query:
            return False
        if "hashtextextended" in query:
            return 1
        if "pg_advisory_lock" in query:
            await self.advisory_lock.acquire()
            return None
        if "pg_advisory_unlock" in query:
            self.advisory_lock.release()
            return True
        if "store_inventory" in query:
            return self.stock
        raise AssertionError(query)

    async def fetchrow(self, query: str, *args):
        return self.product

    def acquire(self):
        return FakeAcquire(self)

    async def execute(self, query: str, *args):
        return None


class SearchSyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_inventory_event_indexes_database_stock_not_stale_payload(self):
        client = RecordingClient()
        message = SimpleNamespace(
            topic="inventory.changed",
            value={
                "product_id": 1,
                "city": "Bengaluru",
                "stock": 9,
                "outbox_event_id": 15,
            },
        )

        await process_message(message, client, InventoryPool(stock=1))

        self.assertIsNotNone(client.indexed)
        self.assertEqual(client.indexed["id"], "1:Bengaluru")
        self.assertEqual(client.indexed["body"]["stock"], 1)
        self.assertEqual(client.deleted, [])

    async def test_inventory_event_removes_document_when_database_row_is_gone(self):
        client = RecordingClient()
        message = SimpleNamespace(
            topic="inventory.changed",
            value={
                "product_id": 1,
                "city": "Bengaluru",
                "stock": 4,
                "outbox_event_id": 16,
            },
        )

        await process_message(message, client, InventoryPool(stock=None))

        self.assertIsNone(client.indexed)
        self.assertEqual(client.deleted, ["1:Bengaluru"])

    async def test_same_product_stock_sync_keeps_search_writes_serialized(self):
        client = BlockingIndexClient()
        pool = InventoryPool(stock=1)

        first_sync = asyncio.create_task(
            sync_stock_from_database(client, pool, 1, "Bengaluru")
        )
        await client.index_started.wait()

        pool.stock = 0
        second_sync = asyncio.create_task(
            sync_stock_from_database(client, pool, 1, "Bengaluru")
        )
        await asyncio.sleep(0)
        self.assertEqual(client.operations, [])

        client.allow_index.set()
        await asyncio.gather(first_sync, second_sync)

        self.assertEqual(client.operations, ["index", "delete"])
        self.assertEqual(client.deleted, ["1:Bengaluru"])


if __name__ == "__main__":
    unittest.main()
