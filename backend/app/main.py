import hashlib
import hmac
import os
import secrets
from contextlib import asynccontextmanager
from typing import Annotated

import asyncpg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from opensearchpy._async.client import AsyncOpenSearch
from pydantic import BaseModel, EmailStr, Field

from app.checkout import OutOfStock, UnknownProduct, place_order
from app.connections import create_opensearch_client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

PG_DSN = os.getenv("PG_DSN")
INDEX_NAME = "products"

pool: asyncpg.Pool | None = None
search_client: AsyncOpenSearch | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global pool, search_client
    if not PG_DSN:
        raise RuntimeError("PG_DSN must be configured")
    pool = await asyncpg.create_pool(PG_DSN, min_size=2, max_size=10)
    try:
        search_client = create_opensearch_client()
        try:
            yield
        finally:
            await search_client.close()
    finally:
        await pool.close()


app = FastAPI(title="PulseCart API", version="1.0.0", lifespan=lifespan)
origins = [
    origin.strip()
    for origin in os.getenv("API_CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Key", "X-Order-Access-Token"],
)


def db_pool() -> asyncpg.Pool:
    if pool is None:
        raise HTTPException(503, "Database is not ready")
    return pool


def os_client() -> AsyncOpenSearch:
    if search_client is None:
        raise HTTPException(503, "Search is not ready")
    return search_client


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    description: str
    category: str
    price_paise: int
    image_url: str | None = None


class InventoryOut(BaseModel):
    product_id: int
    city: str
    stock: int


class CartItem(BaseModel):
    product_id: int = Field(gt=0)
    qty: int = Field(gt=0, le=50)


class CheckoutIn(BaseModel):
    customer_email: EmailStr
    customer_name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    items: list[CartItem] = Field(min_length=1, max_length=50)


class OrderOut(BaseModel):
    order_id: int
    total_paise: int
    status: str
    order_access_token: str


@app.get("/health")
async def health() -> dict:
    checks: dict[str, str] = {}
    try:
        await db_pool().fetchval("SELECT 1")
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = type(exc).__name__
    try:
        await os_client().cluster.health()
        checks["opensearch"] = "ok"
    except Exception as exc:
        checks["opensearch"] = type(exc).__name__
    return {"status": "ok" if all(value == "ok" for value in checks.values()) else "degraded", "checks": checks}


@app.get("/products", response_model=list[ProductOut])
async def list_products(
    category: str | None = None,
    city: str | None = None,
    min_price: Annotated[int | None, Query(ge=0)] = None,
    max_price: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict]:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(422, "min_price cannot exceed max_price")
    clauses: list[str] = []
    params: list[object] = []
    if category:
        params.append(category)
        clauses.append(f"p.category = ${len(params)}")
    if city:
        params.append(city)
        clauses.append(
            "EXISTS (SELECT 1 FROM store_inventory si "
            f"WHERE si.product_id = p.id AND si.city = ${len(params)} AND si.stock > 0)"
        )
    if min_price is not None:
        params.append(min_price)
        clauses.append(f"p.price_paise >= ${len(params)}")
    if max_price is not None:
        params.append(max_price)
        clauses.append(f"p.price_paise <= ${len(params)}")
    params.extend([limit, offset])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = await db_pool().fetch(
        f"""SELECT p.id, p.sku, p.name, p.description, p.category, p.price_paise, p.image_url
            FROM products p {where}
            ORDER BY p.id
            LIMIT ${len(params) - 1} OFFSET ${len(params)}""",
        *params,
    )
    return [dict(row) for row in rows]


@app.get("/products/search")
async def search_products(
    q: Annotated[str, Query(min_length=1, max_length=120)],
    category: str | None = None,
    city: str | None = None,
    min_price: Annotated[int | None, Query(ge=0)] = None,
    max_price: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[dict]:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(422, "min_price cannot exceed max_price")
    filters: list[dict] = [{"range": {"stock": {"gt": 0}}}]
    if category:
        filters.append({"term": {"category": category}})
    if city:
        filters.append({"term": {"city": city}})
    price_range: dict[str, int] = {}
    if min_price is not None:
        price_range["gte"] = min_price
    if max_price is not None:
        price_range["lte"] = max_price
    if price_range:
        filters.append({"range": {"price_paise": price_range}})
    response = await os_client().search(
        index=INDEX_NAME,
        body={
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": q,
                                "fields": ["name^3", "description", "sku"],
                                "fuzziness": "AUTO",
                            }
                        }
                    ],
                    "filter": filters,
                }
            },
            "collapse": {"field": "product_id"},
            "size": limit,
            "highlight": {"fields": {"name": {}, "description": {}}},
        },
    )
    return [
        {
            **hit["_source"],
            "id": hit["_source"]["product_id"],
            "highlight": hit.get("highlight", {}),
            "score": hit["_score"],
        }
        for hit in response["hits"]["hits"]
    ]


@app.get("/products/{product_id}/inventory", response_model=list[InventoryOut])
async def product_inventory(product_id: int) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT product_id, city, stock FROM store_inventory
           WHERE product_id = $1 ORDER BY city""",
        product_id,
    )
    return [dict(row) for row in rows]


@app.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: int) -> dict:
    row = await db_pool().fetchrow(
        """SELECT id, sku, name, description, category, price_paise, image_url
           FROM products WHERE id = $1""",
        product_id,
    )
    if row is None:
        raise HTTPException(404, "Product not found")
    return dict(row)


@app.post("/checkout", response_model=OrderOut)
async def checkout(data: CheckoutIn) -> dict:
    db = db_pool()
    async with db.acquire() as conn:
        customer_id = await conn.fetchval(
            """INSERT INTO customers (email, name, city) VALUES ($1, $2, $3)
               ON CONFLICT (email) DO NOTHING RETURNING id""",
            str(data.customer_email),
            data.customer_name,
            data.city,
        )
        if customer_id is None:
            customer_id = await conn.fetchval(
                "SELECT id FROM customers WHERE email = $1",
                str(data.customer_email),
            )
    order_access_token = secrets.token_urlsafe(32)
    access_token_hash = hash_order_access_token(order_access_token)
    try:
        order_id = await place_order(
            db,
            customer_id,
            data.city,
            [(item.product_id, item.qty) for item in data.items],
            access_token_hash,
        )
    except OutOfStock as exc:
        raise HTTPException(409, f"Product {exc.product_id} is out of stock in {data.city}") from exc
    except UnknownProduct as exc:
        raise HTTPException(404, f"Product {exc.product_id} was not found") from exc
    row = await db.fetchrow(
        "SELECT total_paise, status FROM orders WHERE id = $1", order_id
    )
    return {
        "order_id": order_id,
        "total_paise": row["total_paise"],
        "status": row["status"],
        "order_access_token": order_access_token,
    }


@app.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    x_order_access_token: Annotated[str | None, Header()] = None,
) -> dict:
    if not x_order_access_token:
        raise HTTPException(401, "Order access token required")
    db = db_pool()
    access_token_hash = hash_order_access_token(x_order_access_token)
    async with db.acquire() as conn:
        order = await conn.fetchrow(
            """SELECT id, city, status, total_paise, created_at
               FROM orders WHERE id = $1 AND access_token_hash = $2""",
            order_id,
            access_token_hash,
        )
        if order is None:
            raise HTTPException(404, "Order not found or access token is invalid")
        items = await conn.fetch(
            """SELECT oi.product_id, oi.qty, oi.price_paise, p.name, p.sku
               FROM order_items oi JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = $1 ORDER BY oi.product_id""",
            order_id,
        )
    return {"order": dict(order), "items": [dict(item) for item in items]}


def hash_order_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@app.get("/categories")
async def list_categories() -> list[str]:
    rows = await db_pool().fetch("SELECT DISTINCT category FROM products ORDER BY category")
    return [row["category"] for row in rows]


@app.get("/cities")
async def list_cities() -> list[str]:
    rows = await db_pool().fetch("SELECT DISTINCT city FROM store_inventory ORDER BY city")
    return [row["city"] for row in rows]


def require_admin_key(x_admin_key: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("ADMIN_KEY")
    environment = os.getenv("APP_ENV", "production").lower()
    if not expected:
        if environment == "development":
            return
        raise HTTPException(503, "Admin access is not configured")
    if x_admin_key is None or not hmac.compare_digest(
        x_admin_key.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(401, "Invalid admin key")


@app.get("/admin/orders")
async def admin_orders(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT o.id, o.customer_id, o.city, o.status, o.total_paise, o.created_at
           FROM orders o ORDER BY o.created_at DESC LIMIT $1""",
        limit,
    )
    result = []
    for row in rows:
        items = await db_pool().fetch(
            """SELECT oi.product_id, oi.qty, oi.price_paise, p.name, p.sku
               FROM order_items oi JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = $1""",
            row["id"],
        )
        result.append({**dict(row), "items": [dict(item) for item in items]})
    return result


@app.get("/admin/outbox")
async def admin_outbox(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT id, topic, key, payload, created_at, published_at
           FROM outbox_events ORDER BY id DESC LIMIT $1""",
        limit,
    )
    return [dict(row) for row in rows]


@app.get("/admin/inventory")
async def admin_inventory(
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT p.id, p.sku, p.name, p.category, p.price_paise,
                  COALESCE(jsonb_object_agg(si.city, si.stock)
                    FILTER (WHERE si.city IS NOT NULL), '{}'::jsonb) AS inventory
           FROM products p LEFT JOIN store_inventory si ON si.product_id = p.id
           GROUP BY p.id ORDER BY p.id"""
    )
    return [dict(row) for row in rows]
