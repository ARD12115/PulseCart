import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

from app.connections import postgres_connection_kwargs

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

CITIES = ["Bengaluru", "Mangaluru", "Mysuru", "Hubballi"]
CATEGORIES = {
    "electronics": [
        ("Bluetooth Headphones", "Wireless over-ear headphones with ANC"),
        ("USB-C Hub", "Seven-in-one adapter with HDMI and power delivery"),
        ("Mechanical Keyboard", "Hot-swappable keyboard with RGB backlight"),
        ("Portable SSD 1TB", "NVMe drive with fast read speeds"),
        ("Webcam 4K", "Autofocus webcam with privacy cover"),
        ("Wireless Mouse", "Ergonomic mouse with long battery life"),
        ("Laptop Stand", "Adjustable aluminum laptop stand"),
        ("Monitor Light Bar", "Auto-dimming asymmetrical desk light"),
        ("Bluetooth Speaker", "Portable stereo speaker"),
        ("Power Bank 20000mAh", "USB-C fast-charging power bank"),
        ("Wireless Earbuds", "Compact wireless earbuds"),
        ("Laptop Backpack", "Water-resistant laptop backpack"),
        ("USB-C Charger", "65W GaN charger with foldable plug"),
    ],
    "home": [
        ("Air Purifier", "HEPA purifier for everyday rooms"),
        ("Robot Vacuum", "Smart robot vacuum with app control"),
        ("Smart Bulb 4-pack", "Matter smart bulbs with color control"),
        ("Coffee Scale", "Precision coffee scale with timer"),
        ("Electric Kettle", "Variable-temperature electric kettle"),
        ("Standing Desk", "Dual-motor desk with memory presets"),
        ("Ergonomic Chair", "Mesh chair with lumbar support"),
        ("Whiteboard", "Magnetic office whiteboard"),
        ("Desk Organizer", "Modular storage for a tidy workspace"),
        ("Floor Lamp", "Dimmable LED floor lamp"),
        ("Smart Plug", "Wi-Fi outlet with energy monitoring"),
        ("Bedside Table", "Compact table with storage shelf"),
        ("Air Quality Monitor", "Indoor particulate monitor"),
    ],
    "fitness": [
        ("Adjustable Dumbbells", "Quick-switch adjustable dumbbells"),
        ("Resistance Bands Set", "Five-level bands with door anchor"),
        ("Yoga Mat", "Comfortable non-slip yoga mat"),
        ("Foam Roller", "Textured high-density foam roller"),
        ("Jump Rope", "Weighted handles with smooth bearings"),
        ("Kettlebell 16kg", "Powder-coated cast-iron kettlebell"),
        ("Pull-up Bar", "Doorway pull-up bar"),
        ("Massage Gun", "Massage gun with interchangeable heads"),
        ("Fitness Tracker", "Wearable activity and sleep tracker"),
        ("Exercise Mat", "Extra-thick non-slip floor mat"),
        ("Water Bottle", "Insulated stainless steel bottle"),
        ("Ab Roller", "Dual-wheel core training roller"),
    ],
    "kitchen": [
        ("Air Fryer", "Large-capacity air fryer"),
        ("Blender", "High-power blender with durable jar"),
        ("Food Processor", "Multi-blade food processor"),
        ("Stand Mixer", "Tilt-head stand mixer"),
        ("Toaster Oven", "Convection toaster oven"),
        ("Immersion Blender", "Hand blender with whisk attachment"),
        ("Coffee Grinder", "Conical burr coffee grinder"),
        ("Digital Scale", "Compact digital kitchen scale"),
        ("Rice Cooker", "Rice cooker with keep-warm mode"),
        ("Knife Set", "Stainless-steel chef and utility knives"),
        ("Storage Containers", "Airtight stackable container set"),
        ("Pressure Cooker", "Stovetop pressure cooker"),
    ],
}


def product_price(sku: str) -> int:
    return 999 + sum(map(ord, sku)) % 49001


async def main() -> None:
    dsn = os.getenv("PG_DSN")
    if not dsn:
        raise RuntimeError("PG_DSN is not configured")

    pool = await asyncpg.create_pool(
        dsn, min_size=1, max_size=4, **postgres_connection_kwargs()
    )
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                products: list[tuple[int, str]] = []
                for category, entries in CATEGORIES.items():
                    for name, description in entries:
                        sku = f"{category[:3].upper()}-{'-'.join(name.upper().split())}"
                        product_id = await conn.fetchval(
                            """INSERT INTO products
                               (sku, name, description, category, price_paise)
                               VALUES ($1, $2, $3, $4, $5)
                               ON CONFLICT (sku) DO UPDATE SET
                                 name = EXCLUDED.name,
                                 description = EXCLUDED.description,
                                 category = EXCLUDED.category,
                                 price_paise = EXCLUDED.price_paise
                               RETURNING id""",
                            sku,
                            name,
                            description,
                            category,
                            product_price(sku),
                        )
                        products.append((product_id, name))

                for city in CITIES:
                    for product_id, name in products:
                        stock = 1 if name == "Bluetooth Headphones" and city == "Bengaluru" else 10
                        await conn.execute(
                            """INSERT INTO store_inventory (product_id, city, stock)
                               VALUES ($1, $2, $3)
                               ON CONFLICT (product_id, city) DO NOTHING""",
                            product_id,
                            city,
                            stock,
                        )

                for number, city in enumerate(CITIES, start=1):
                    await conn.execute(
                        """INSERT INTO customers (email, name, city)
                           VALUES ($1, $2, $3)
                           ON CONFLICT (email) DO NOTHING""",
                        f"buyer{number}@example.com",
                        f"Test Buyer {number}",
                        city,
                    )
                product_count = await conn.fetchval("SELECT COUNT(*) FROM products")
                inventory_count = await conn.fetchval("SELECT COUNT(*) FROM store_inventory")
                print(
                    f"Seed complete: {product_count} products, "
                    f"{inventory_count} inventory rows across {len(CITIES)} cities"
                )
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
