import json

import asyncpg


class OutOfStock(Exception):
    def __init__(self, product_id: int):
        super().__init__(f"product {product_id} is out of stock")
        self.product_id = product_id


class UnknownProduct(Exception):
    def __init__(self, product_id: int):
        super().__init__(f"product {product_id} does not exist")
        self.product_id = product_id


async def place_order(
    pool: asyncpg.Pool,
    customer_id: int,
    city: str,
    items: list[tuple[int, int]],
) -> int:
    """Create an order and outbox events atomically; items are product ID/quantity pairs."""
    quantities: dict[int, int] = {}
    for product_id, qty in items:
        if product_id <= 0 or qty <= 0:
            raise ValueError("Product IDs and quantities must be positive")
        quantities[product_id] = quantities.get(product_id, 0) + qty
    if not quantities:
        raise ValueError("Checkout requires at least one item")

    async with pool.acquire() as conn:
        async with conn.transaction():
            lines: list[tuple[int, int, int, int]] = []
            total = 0
            for product_id, qty in sorted(quantities.items()):
                row = await conn.fetchrow(
                    """UPDATE store_inventory
                       SET stock = stock - $3
                       WHERE product_id = $1 AND city = $2 AND stock >= $3
                       RETURNING stock""",
                    product_id,
                    city,
                    qty,
                )
                if row is None:
                    exists = await conn.fetchval(
                        "SELECT 1 FROM products WHERE id = $1", product_id
                    )
                    if not exists:
                        raise UnknownProduct(product_id)
                    raise OutOfStock(product_id)

                price = await conn.fetchval(
                    "SELECT price_paise FROM products WHERE id = $1", product_id
                )
                if price is None:
                    raise UnknownProduct(product_id)
                total += price * qty
                lines.append((product_id, qty, price, row["stock"]))

            order_id = await conn.fetchval(
                """INSERT INTO orders (customer_id, city, total_paise)
                   VALUES ($1, $2, $3) RETURNING id""",
                customer_id,
                city,
                total,
            )
            for product_id, qty, price, _ in lines:
                await conn.execute(
                    """INSERT INTO order_items (order_id, product_id, qty, price_paise)
                       VALUES ($1, $2, $3, $4)""",
                    order_id,
                    product_id,
                    qty,
                    price,
                )

            await _write_outbox(
                conn,
                "order.placed",
                str(order_id),
                {
                    "order_id": order_id,
                    "customer_id": customer_id,
                    "city": city,
                    "total_paise": total,
                    "items": [
                        {"product_id": product_id, "qty": qty}
                        for product_id, qty, _, _ in lines
                    ],
                },
            )
            for product_id, _, _, stock in lines:
                await _write_outbox(
                    conn,
                    "inventory.changed",
                    f"{product_id}:{city}",
                    {"product_id": product_id, "city": city, "stock": stock},
                )
            return order_id


async def _write_outbox(
    conn: asyncpg.Connection, topic: str, key: str, payload: dict
) -> None:
    await conn.execute(
        "INSERT INTO outbox_events (topic, key, payload) VALUES ($1, $2, $3::jsonb)",
        topic,
        key,
        json.dumps(payload),
    )
