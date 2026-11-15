
# PulseCart

PulseCart is an online store demo built around PostgreSQL, Kafka, and OpenSearch. PostgreSQL owns inventory and orders; a transactional outbox publishes changes to Kafka; idempotent workers sync search and log order confirmations.

> **Pitch:** Stock is decided in Postgres, and Kafka spreads the news.

The storefront uses Next.js 16 and React 19.

## What it demonstrates

- Atomic checkout prevents two buyers from purchasing the same last unit.
- The order and its Kafka events are committed together through the outbox pattern.
- Search results come from OpenSearch and support fuzzy matching, category, price, and city filters.
- A race demo sends two simultaneous requests for one seeded last-unit item.
- Per-city inventory makes availability a real filter rather than a label.
- Carts are stored in PostgreSQL (`carts`, `cart_items`), so a cart survives clearing the browser's local storage.
- Checkout accepts an `Idempotency-Key` header: a retried or double-clicked request returns the original order instead of creating a second one.
- Order confirmations are created by a Kafka consumer, stored in `notifications`, and emailed when SMTP is configured.
- A consumer retries a failing message three times, then records it in `dead_letter_events` and moves on instead of crashing.
- Search understands synonyms: "earphones" also finds earbuds and headphones, and typos still work.

## Run locally with Docker Compose

Requirements: Docker Desktop (or another Docker Compose v2 runtime) with at least 4 GB of memory available.

```powershell
docker compose up --build
```

Open:

- Storefront: http://localhost:3000
- API docs: http://localhost:8000/docs (enable with `API_DOCS_ENABLED=true` in the root `.env`)
- API health: http://localhost:8000/health
- OpenSearch: http://localhost:9200

The local Compose stack includes PostgreSQL, Kafka, and OpenSearch. Its published ports bind to localhost only; it does not need Aiven credentials or certificates. The backend seeds 50 products on startup. API docs and the OpenAPI schema are disabled by default; after setting `API_DOCS_ENABLED=true` in the ignored root `.env`, recreate the backend with `docker compose up -d --force-recreate backend`. Leave docs disabled in public deployments.
Compose defaults to a production-safe admin policy: admin endpoints require `ADMIN_KEY`. For a local-only, unauthenticated admin demo, explicitly set `APP_ENV=development` in the shell before starting Compose (PowerShell: `$env:APP_ENV='development'`). Never use development mode on a public deployment.

To stop the services, press `Ctrl+C`, then run `docker compose down`. Add `-v` only if you intentionally want to delete the local database and search data.

### Change the local PostgreSQL password without deleting data

Changing `POSTGRES_PASSWORD` in `.env` does not change the password of a database that already exists in the `postgres_data` volume; the official Postgres image only applies that variable when initializing an empty data directory. Do not remove the volume to rotate credentials.

1. Take and verify a database backup.
2. Connect to the existing database over TCP using the current password: `docker compose exec postgres psql -h 127.0.0.1 -U postgres -d pulsecart`. Enter the current password when prompted.
3. At the `psql` prompt, run `\password postgres`, enter the new password twice, then exit with `\q`.
4. Update both `POSTGRES_PASSWORD` and `PG_PASSWORD` in the ignored root `.env` to the new raw password. Keep the password out of `PG_DSN`; Compose passes it separately to asyncpg, so URI-special characters do not need URL encoding. If using a `.env` value containing `$`, escape it as `$$` for Compose interpolation.
5. Recreate the services that connect to PostgreSQL: `docker compose up -d --force-recreate postgres backend relay search-sync notification`. This preserves `postgres_data`; do not run `docker compose down -v`.

## Run against Aiven

1. Create PostgreSQL, Kafka, and OpenSearch services in the same Aiven project/region.
2. Copy `.env.example` to `.env`; set a password-free PostgreSQL DSN (with `?sslmode=require`) and put its raw password in `PG_PASSWORD`; set the Kafka bootstrap host, OpenSearch HTTPS URL and service username/password, and CORS origin.
3. Configure Kafka with `KAFKA_SECURITY_PROTOCOL=SSL`; download `ca.pem`, `service.cert`, and `service.key` into the ignored `certs/` folder. Never commit secrets.
4. Create Kafka topics `order.placed` and `inventory.changed`.
5. Apply `db/schema.sql` to a new Aiven PostgreSQL database. For an existing database, apply each migration in `db/migrations/` using the provider's SQL console or `psql "$env:PG_DSN" -W -f db/migrations/001_order_access_token.sql`. Existing orders created before `001_order_access_token.sql` have no customer access token, so customer lookup through `GET /orders/{order_id}` is intentionally unavailable for those legacy orders; use the protected admin view if they must be inspected.
6. Set `APP_ENV=production` and a long random `ADMIN_KEY` in the deployment environment before exposing the API.
7. When a trusted reverse proxy sits directly in front of the API, set `TRUSTED_PROXY_IPS` to only that proxy's IP address or CIDR and configure it to replace any incoming `X-Forwarded-For` header. Uvicorn proxy-header rewriting is disabled so untrusted headers cannot change the limiter's client key.
8. Install backend requirements, seed once, then start the API and workers in separate terminals:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --no-proxy-headers --port 8000
```

In separate terminals, from `backend/`, run:

```powershell
python -m app.outbox_relay
python -m app.search_sync
python -m app.notification
```

Run the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The local `.env` is read from the project root. Aiven credentials and TLS certificates are intentionally not included.

## Before a demo: check the Aiven services

```powershell
cd backend
python -m app.preflight
```

It checks that PostgreSQL has the schema and products, that Kafka has the `order.placed` and `inventory.changed` topics, and that the OpenSearch `products` index exists and has documents. Fix every `FAIL` line before presenting. Then run the demo against Aiven, not the local Compose stack, so judges see all three services doing real work.

For a busy demo (several people ordering from one network), raise the checkout limit in `.env`, for example `CHECKOUT_RATE_LIMIT=30/minute`. The default stays strict at `5/minute`.

## Demo walkthrough

1. Browse products and try searching `bluetoth`.
2. Filter by city/category/price and add a product to your cart.
3. Checkout with an email, name, and delivery city. Save both the displayed order ID and private access code; the ID selects the order, and the code authorizes access to its details.
4. Open `/admin` to inspect orders and outbox publication.
5. Open `/demo`, choose the seeded Bluetooth Headphones item in Bengaluru (the first product ID on a fresh database), and run the race. One checkout should succeed and the other should get an out-of-stock response.

## Project layout

```text
backend/app/       FastAPI API, checkout, seed, relay, and workers
db/schema.sql      PostgreSQL schema
frontend/app/      Next.js storefront, cart, admin, and demo
docker-compose.yml Local PostgreSQL, Kafka, and OpenSearch stack
scripts/           Pitch deck generator
```

The editable pitch deck is `PulseCart_HackBriven.pptx`; a PDF version is also included for sharing. Regenerate the deck with `python -m pip install -r requirements-presentation.txt` and `python scripts/create_pitch_deck.py`.

## Operational notes

- Consumers record handled outbox event IDs in `processed_events`.
- Kafka delivery is at-least-once; outbox event IDs make consumer processing idempotent.
- Admin routes require `ADMIN_KEY` unless `APP_ENV=development` is explicitly selected. Order details require the private access code returned at checkout; only its hash is stored.
- Customer order lookup is available only for orders created after the access-token migration; legacy orders have no automatically issued access credential.
- The notification worker stores one confirmation per order in `notifications` and delivers it by SMTP when `SMTP_HOST` is set; without SMTP it only logs it (status `logged`). Email delivery is at-least-once: a crash between the SMTP server accepting a message and the row being marked `sent` can send that one email again. Configure payment and fulfillment before accepting real orders.
- The outbox relay locks rows with `FOR UPDATE SKIP LOCKED`, retries with backoff when Kafka is unavailable, and marks events that reached Kafka as published even if a later event in the batch fails.
- Messages a consumer cannot process are written to `dead_letter_events` (see `/admin`). If the database itself is down the consumer exits and Docker restarts it, so nothing is skipped without being recorded.
- Replaying a checkout with the same `Idempotency-Key` returns the original order with `Idempotent-Replay: true` and no `order_access_token`, because only its hash is stored. Keep the token from the first response.
- Cart IDs are random UUIDs and act as the cart's access secret. Remove old carts with `DELETE FROM carts WHERE updated_at < now() - interval '30 days'` if the table grows.

## Tests

```powershell
cd backend
python -m unittest discover -s tests
```

`tests/test_postgres_integration.py` is skipped unless `TEST_PG_DSN` points at a disposable PostgreSQL database that already has `db/schema.sql` applied (it marks unpublished outbox events as published).

- Keep Aiven credentials in environment variables and certificates in the ignored `certs/` directory.
