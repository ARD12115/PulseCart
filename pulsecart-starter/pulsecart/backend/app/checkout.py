"""Atomic checkout: stock decrement + order + outbox events in ONE transaction."""
import json
import asyncpg


class OutOfStock(Exception):
    def __init__(self, product_id: int):
        super().__init__(f"product {product_id} is out of stock")
        self.product_id = product_id


async def place_order(pool: asyncpg.Pool, customer_id: int, city: str,
                      items: list[tuple[int, int]]) -> int:
    """items = [(product_id, qty)]. Returns the new order id or raises OutOfStock."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            order_lines, total = [], 0
            # Lock rows in a fixed order so two carts can't deadlock each other.
            for product_id, qty in sorted(items):
                # The WHERE clause is the whole trick: only one buyer can win the last unit.
                left = await conn.fetchval(
                    """UPDATE store_inventory SET stock = stock - $3
                       WHERE product_id = $1 AND city = $2 AND stock >= $3
                       RETURNING stock""",
                    product_id, city, qty)
                if left is None:
                    raise OutOfStock(product_id)  # rolls back everything above
                price = await conn.fetchval(
                    "SELECT price_paise FROM products WHERE id = $1", product_id)
                total += price * qty
                order_lines.append((product_id, qty, price, left))

            order_id = await conn.fetchval(
                """INSERT INTO orders (customer_id, city, total_paise)
                   VALUES ($1, $2, $3) RETURNING id""", customer_id, city, total)
            for product_id, qty, price, _ in order_lines:
                await conn.execute(
                    """INSERT INTO order_items (order_id, product_id, qty, price_paise)
                       VALUES ($1, $2, $3, $4)""", order_id, product_id, qty, price)

            await _outbox(conn, "order.placed", str(order_id), {
                "order_id": order_id, "customer_id": customer_id, "city": city,
                "total_paise": total,
                "items": [{"product_id": p, "qty": q} for p, q, _, _ in order_lines]})
            for product_id, _, _, left in order_lines:
                await _outbox(conn, "inventory.changed", f"{product_id}:{city}", {
                    "product_id": product_id, "city": city, "stock": left})
            return order_id


async def _outbox(conn, topic: str, key: str, payload: dict) -> None:
    await conn.execute(
        "INSERT INTO outbox_events (topic, key, payload) VALUES ($1, $2, $3::jsonb)",
        topic, key, json.dumps(payload))
