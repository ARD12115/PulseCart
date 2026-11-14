import unittest
from types import SimpleNamespace

from app.search_sync import process_message


class RecordingClient:
    def __init__(self):
        self.indexed: dict | None = None
        self.deleted: list[str] = []

    async def index(self, **kwargs):
        self.indexed = kwargs

    async def delete(self, **kwargs):
        self.deleted.append(kwargs["id"])


class InventoryPool:
    def __init__(self, stock: int | None):
        self.stock = stock
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
        if "store_inventory" in query:
            return self.stock
        raise AssertionError(query)

    async def fetchrow(self, query: str, *args):
        return self.product

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


if __name__ == "__main__":
    unittest.main()
