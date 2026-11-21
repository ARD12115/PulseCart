import json
from datetime import datetime
from uuid import UUID

import asyncpg
from fastapi import HTTPException


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
    access_token_hash: str,
    *,
    idempotency_key: str | None = None,
    cart_id: UUID | None = None,
    cart_secret: str | None = None,
    access_token_expires_at: datetime,
) -> int:
    """Create an order and outbox events atomically; items are product ID/quantity pairs.

    With an idempotency key, a second order for the same customer and key violates the
    unique index; the whole transaction (including the stock decrement) rolls back and
    asyncpg.UniqueViolationError propagates so the caller can return the original order.
    A cart_id is emptied in the same transaction as the order only when cart_secret
    matches the stored secret for that cart.
    """
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
                """INSERT INTO orders
                       (customer_id, city, total_paise, access_token_hash, idempotency_key,
                        access_token_expires_at)
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
                customer_id,
                city,
                total,
                access_token_hash,
                idempotency_key,
                access_token_expires_at,
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
            if cart_id is not None:
                if cart_secret is None:
                    raise HTTPException(401, "Cart secret required to check out this cart")
                verified = await conn.fetchval(
                    "SELECT 1 FROM carts WHERE id = $1 AND cart_secret = $2",
                    cart_id,
                    cart_secret,
                )
                if not verified:
                    raise HTTPException(401, "Invalid cart secret for this cart")
                await conn.execute("DELETE FROM cart_items WHERE cart_id = $1", cart_id)
            return order_id


async def _write_outbox(
    conn: asyncpg.Connection, topic: str, key: str, payload: dict
) -> None:
    await conn.execute(
        "INSERT INTO outbox_events (topic, key, payload, consumer_status) VALUES ($1, $2, $3::jsonb, 'pending')",
        topic,
        key,
        json.dumps(payload),
    )
