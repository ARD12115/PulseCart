import asyncio
import hashlib
import hmac
import ipaddress
import logging
import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import asyncpg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opensearchpy._async.client import AsyncOpenSearch
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.checkout import OutOfStock, UnknownProduct, place_order
from app.connections import create_opensearch_client, postgres_connection_kwargs
from app.search_terms import expand_query

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

PG_DSN = os.getenv("PG_DSN")
INDEX_NAME = "products"
log = logging.getLogger("pulsecart")
IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,100}$")
ORDER_ACCESS_TOKEN_TTL = timedelta(days=90)
CART_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60
CART_RETENTION_DAYS = 30


def checkout_rate_limit() -> str:
    # Default stays strict; raise it in .env for a busy demo (for example "30/minute").
    return os.getenv("CHECKOUT_RATE_LIMIT", "5/minute")


def cart_rate_limit() -> str:
    return os.getenv("CART_RATE_LIMIT", "120/minute")

pool: asyncpg.Pool | None = None
search_client: AsyncOpenSearch | None = None

trusted_proxy_networks = tuple(
    ipaddress.ip_network(value.strip(), strict=False)
    for value in os.getenv("TRUSTED_PROXY_IPS", "").split(",")
    if value.strip()
)


def get_client_address(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return peer

    if not any(peer_ip in network for network in trusted_proxy_networks):
        return peer_ip.compressed

    forwarded_for = request.headers.get("x-forwarded-for", "")
    for address in reversed(forwarded_for.split(",")):
        try:
            candidate = ipaddress.ip_address(address.strip())
        except ValueError:
            return peer_ip.compressed
        if not any(candidate in network for network in trusted_proxy_networks):
            return candidate.compressed
    return peer_ip.compressed


limiter = Limiter(key_func=get_client_address)


async def cart_cleanup_loop(db: asyncpg.Pool) -> None:
    while True:
        try:
            result = await db.execute(
                "DELETE FROM carts WHERE updated_at < now() - ($1 * interval '1 day')",
                CART_RETENTION_DAYS,
            )
            log.info("Expired carts cleanup: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Expired carts cleanup failed")
        await asyncio.sleep(CART_CLEANUP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global pool, search_client
    if not PG_DSN:
        raise RuntimeError("PG_DSN must be configured")
    pool = await asyncpg.create_pool(
        PG_DSN, min_size=2, max_size=10, **postgres_connection_kwargs()
    )
    cleanup_task = asyncio.create_task(cart_cleanup_loop(pool))
    try:
        search_client = create_opensearch_client()
        try:
            yield
        finally:
            await search_client.close()
    finally:
        cleanup_task.cancel()
        await asyncio.gather(cleanup_task, return_exceptions=True)
        await pool.close()


def create_app() -> FastAPI:
    docs_enabled = os.getenv("API_DOCS_ENABLED", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    return FastAPI(
        title="PulseCart API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )


app = create_app()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path not in {"/docs", "/redoc"}:
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    return response


origins = [
    origin.strip()
    for origin in os.getenv("API_CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=[
        "Content-Type",
        "Idempotency-Key",
        "X-Admin-Key",
        "X-Order-Access-Token",
    ],
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
    cart_id: UUID | None = None  # emptied in the same transaction as the order

class OrderOut(BaseModel):
    order_id: int
    total_paise: int
    status: str
    # None when an Idempotency-Key replay returns an existing order: only the hash of the
    # token is stored, so the original token cannot be shown again.
    order_access_token: str | None = None
    order_access_token_expires_at: datetime | None = None


class CartLineIn(BaseModel):
    product_id: int = Field(gt=0)
    qty: int = Field(gt=0, le=50)


class CartIn(BaseModel):
    items: list[CartLineIn] = Field(max_length=50)


class CartLineOut(BaseModel):
    id: int
    sku: str
    name: str
    price_paise: int
    qty: int


class CartOut(BaseModel):
    cart_id: UUID
    updated_at: datetime
    items: list[CartLineOut]


class CartCreated(CartOut):
    cart_secret: str


@app.get("/health")
async def health() -> JSONResponse:
    checks: dict[str, str] = {}
    try:
        await db_pool().fetchval("SELECT 1")
        checks["postgres"] = "ok"
    except Exception as exc:
        log.warning("health: postgres check failed: %s", type(exc).__name__)
        checks["postgres"] = "unavailable"
    try:
        await os_client().cluster.health()
        checks["opensearch"] = "ok"
    except Exception as exc:
        log.warning("health: opensearch check failed: %s", type(exc).__name__)
        checks["opensearch"] = "unavailable"
    healthy = all(value == "ok" for value in checks.values())
    # 503 when degraded so Docker and load balancers see the failure.
    return JSONResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status_code=200 if healthy else 503,
    )


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
                                "query": expand_query(q),
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


async def _existing_order(
    db: asyncpg.Pool, customer_id: int, idempotency_key: str
) -> dict | None:
    row = await db.fetchrow(
        """SELECT id, total_paise, status, access_token_expires_at FROM orders
           WHERE customer_id = $1 AND idempotency_key = $2""",
        customer_id,
        idempotency_key,
    )
    if row is None:
        return None
    return {
        "order_id": row["id"],
        "total_paise": row["total_paise"],
        "status": row["status"],
        "order_access_token": None,
        "order_access_token_expires_at": row["access_token_expires_at"],
    }


@app.post("/checkout", response_model=OrderOut)
@limiter.limit(checkout_rate_limit)
async def checkout(
    request: Request,
    response: Response,
    data: CheckoutIn,
    idempotency_key: Annotated[str | None, Header()] = None,
    x_cart_secret: Annotated[str | None, Header()] = None,
) -> dict:
    if idempotency_key is not None and not IDEMPOTENCY_KEY_PATTERN.match(idempotency_key):
        raise HTTPException(
            422, "Idempotency-Key must be 8-100 characters: letters, digits, . _ : -"
        )
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
    if idempotency_key:
        replay = await _existing_order(db, customer_id, idempotency_key)
        if replay is not None:
            response.headers["Idempotent-Replay"] = "true"
            return replay

    # Validate cart secret before any order creation or cart modification.
    if data.cart_id is not None:
        if x_cart_secret is None:
            raise HTTPException(401, "Cart secret required")
        verified = await db.fetchval(
            "SELECT 1 FROM carts WHERE id = $1 AND cart_secret = $2",
            data.cart_id,
            x_cart_secret,
        )
        if not verified:
            raise HTTPException(401, "Invalid cart secret for this cart")

    order_access_token = secrets.token_urlsafe(32)
    access_token_hash = hash_order_access_token(order_access_token)
    access_token_expires_at = datetime.now(timezone.utc) + ORDER_ACCESS_TOKEN_TTL
    try:
        order_id = await place_order(
            db,
            customer_id,
            data.city,
            [(item.product_id, item.qty) for item in data.items],
            access_token_hash,
            idempotency_key=idempotency_key,
            cart_id=data.cart_id,
            cart_secret=x_cart_secret,
            access_token_expires_at=access_token_expires_at,
        )
    except OutOfStock as exc:
        raise HTTPException(409, f"Product {exc.product_id} is out of stock in {data.city}") from exc
    except UnknownProduct as exc:
        raise HTTPException(404, f"Product {exc.product_id} was not found") from exc
    except asyncpg.UniqueViolationError:
        # Two requests with the same key raced; the loser's transaction (including its
        # stock decrement) rolled back, so return the winner's order.
        replay = (
            await _existing_order(db, customer_id, idempotency_key)
            if idempotency_key
            else None
        )
        if replay is None:
            raise
        response.headers["Idempotent-Replay"] = "true"
        return replay
    row = await db.fetchrow(
        "SELECT total_paise, status FROM orders WHERE id = $1", order_id
    )
    return {
        "order_id": order_id,
        "total_paise": row["total_paise"],
        "status": row["status"],
        "order_access_token": order_access_token,
        "order_access_token_expires_at": access_token_expires_at,
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
               FROM orders
               WHERE id = $1 AND access_token_hash = $2
                 AND access_token_expires_at > now()
                 AND access_token_revoked_at IS NULL""",
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


@app.post("/orders/{order_id}/revoke-access", status_code=204)
async def revoke_order_access(
    order_id: int,
    x_order_access_token: Annotated[str | None, Header()] = None,
) -> Response:
    if not x_order_access_token:
        raise HTTPException(401, "Order access token required")
    result = await db_pool().execute(
        """UPDATE orders
           SET access_token_revoked_at = COALESCE(access_token_revoked_at, now())
           WHERE id = $1 AND access_token_hash = $2""",
        order_id,
        hash_order_access_token(x_order_access_token),
    )
    if result.endswith(" 0"):
        raise HTTPException(404, "Order not found or access token is invalid")
    return Response(status_code=204)


def hash_order_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _load_cart(conn: asyncpg.Connection, cart_id: UUID) -> dict | None:
    cart = await conn.fetchrow("SELECT id, updated_at FROM carts WHERE id = $1", cart_id)
    if cart is None:
        return None
    rows = await conn.fetch(
        """SELECT p.id, p.sku, p.name, p.price_paise, ci.qty
           FROM cart_items ci JOIN products p ON p.id = ci.product_id
           WHERE ci.cart_id = $1 ORDER BY p.id""",
        cart_id,
    )
    return {"cart_id": cart_id, "updated_at": cart["updated_at"], "items": [dict(row) for row in rows]}


@app.post("/carts", response_model=CartCreated, status_code=201)
@limiter.limit(cart_rate_limit)
async def create_cart(request: Request, response: Response) -> dict:
    cart = await db_pool().fetchrow(
        "INSERT INTO carts DEFAULT VALUES RETURNING id, updated_at, cart_secret"
    )
    return {
        "cart_id": str(cart["id"]),
        "cart_secret": str(cart["cart_secret"]),
        "updated_at": cart["updated_at"],
        "items": [],
    }


async def require_cart_secret(
    cart_id: UUID,
    x_cart_secret: Annotated[str | None, Header()] = None,
    db: asyncpg.Pool = Depends(db_pool),
) -> None:
    if x_cart_secret is None:
        raise HTTPException(401, "Cart secret required")
    row = await db.fetchrow(
        "SELECT cart_secret FROM carts WHERE id = $1", cart_id
    )
    if row is None:
        raise HTTPException(404, "Cart not found")
    if not hmac.compare_digest(
        x_cart_secret.encode("utf-8"), str(row["cart_secret"]).encode("utf-8")
    ):
        raise HTTPException(401, "Invalid cart secret")


@app.get("/carts/{cart_id}", response_model=CartOut)
@limiter.limit(cart_rate_limit)
async def get_cart(
    request: Request,
    response: Response,
    cart_id: UUID,
    _: None = Depends(require_cart_secret),
) -> dict:
    async with db_pool().acquire() as conn:
        cart = await _load_cart(conn, cart_id)
    if cart is None:
        raise HTTPException(404, "Cart not found")
    return cart


@app.put("/carts/{cart_id}", response_model=CartOut)
@limiter.limit(cart_rate_limit)
async def replace_cart(
    request: Request, response: Response, cart_id: UUID, data: CartIn
) -> dict:
    quantities: dict[int, int] = {}
    for line in data.items:
        quantities[line.product_id] = min(50, quantities.get(line.product_id, 0) + line.qty)
    async with db_pool().acquire() as conn:
        try:
            async with conn.transaction():
                touched = await conn.fetchval(
                    "UPDATE carts SET updated_at = now() WHERE id = $1 RETURNING id", cart_id
                )
                if touched is None:
                    raise HTTPException(404, "Cart not found")
                await conn.execute("DELETE FROM cart_items WHERE cart_id = $1", cart_id)
                if quantities:
                    await conn.executemany(
                        "INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, $3)",
                        [(cart_id, product_id, qty) for product_id, qty in quantities.items()],
                    )
        except asyncpg.ForeignKeyViolationError as exc:
            raise HTTPException(404, "One or more products were not found") from exc
        cart = await _load_cart(conn, cart_id)
    assert cart is not None
    return cart


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
    response: Response,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT o.id, o.customer_id, o.city, o.status, o.total_paise, o.created_at
           FROM orders o ORDER BY o.created_at DESC LIMIT $1""",
        limit,
    )
    response.headers["X-Total-Count"] = str(await db_pool().fetchval("SELECT count(*) FROM orders"))
    items_by_order: dict[int, list[dict]] = {row["id"]: [] for row in rows}
    if items_by_order:
        item_rows = await db_pool().fetch(
            """SELECT oi.order_id, oi.product_id, oi.qty, oi.price_paise, p.name, p.sku
               FROM order_items oi JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = ANY($1::bigint[])
               ORDER BY oi.order_id, oi.product_id""",
            list(items_by_order),
        )
        for item in item_rows:
            record = dict(item)
            items_by_order[record.pop("order_id")].append(record)
    return [{**dict(row), "items": items_by_order[row["id"]]} for row in rows]


@app.delete("/admin/orders/{order_id}", status_code=204)
async def admin_delete_order(
    order_id: int,
    _: None = Depends(require_admin_key),
):
    """Delete an order and its associated order items."""
    await db_pool().execute(
        "DELETE FROM order_items WHERE order_id = $1", order_id
    )
    result = await db_pool().execute(
        "DELETE FROM orders WHERE id = $1", order_id
    )
    # asyncpg returns "DELETE 0" if no row matched
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Order not found")


@app.get("/admin/outbox")
async def admin_outbox(
    response: Response,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT id, topic, key, payload, created_at, published_at
           FROM outbox_events ORDER BY id DESC LIMIT $1""",
        limit,
    )
    response.headers["X-Total-Count"] = str(await db_pool().fetchval("SELECT count(*) FROM outbox_events"))
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


@app.get("/admin/notifications")
async def admin_notifications(
    response: Response,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT id, order_id, recipient_email, subject, status, attempts,
                  last_error, created_at, sent_at
           FROM notifications ORDER BY id DESC LIMIT $1""",
        limit,
    )
    response.headers["X-Total-Count"] = str(await db_pool().fetchval("SELECT count(*) FROM notifications"))
    return [dict(row) for row in rows]


@app.get("/admin/dead-letters")
async def admin_dead_letters(
    response: Response,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    _: None = Depends(require_admin_key),
) -> list[dict]:
    rows = await db_pool().fetch(
        """SELECT id, consumer, topic, kafka_partition, kafka_offset, key, error, created_at
           FROM dead_letter_events ORDER BY id DESC LIMIT $1""",
        limit,
    )
    response.headers["X-Total-Count"] = str(await db_pool().fetchval("SELECT count(*) FROM dead_letter_events"))
    return [dict(row) for row in rows]
