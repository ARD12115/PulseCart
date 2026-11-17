# Aiven Migration Plan — PulseCart

## Target Architecture

| Service | Local (current) | Production (Aiven + Vercel) |
|---------|----------------|------------------------------|
| Frontend | Docker Compose (Next.js) | Vercel (Next.js) |
| Backend | Docker Compose (FastAPI) | Vercel Serverless Functions |
| PostgreSQL | Docker Compose (local) | Aiven for PostgreSQL |
| OpenSearch | Docker Compose (local) | Aiven for OpenSearch |
| Kafka | Docker Compose (local) | Aiven for Apache Kafka |
| Workers (relay/search-sync/notification) | Docker Compose | Not on Vercel — see below |

## What You Need to Provide

1. **Aiven account** — confirmed you have one
2. **Three Aiven services** (all in the same project, same region/private link if possible):
   - `pulsecart-pg` — PostgreSQL
   - `pulsecart-kafka` — Apache Kafka
   - `pulsecart-opensearch` — OpenSearch
3. **Service credentials** from Aiven console:
   - PostgreSQL: host, port, user, password, database, CA cert
   - Kafka: bootstrap servers, security protocol, SASL/SCRAM credentials
   - OpenSearch: host, port, username, password
4. **Root `.env`** values for:
   - `PULSECART_APP_PASSWORD` — app DB role password
   - `OPENSEARCH_ADMIN_PASSWORD` — OpenSearch admin password
   - `ADMIN_KEY` — admin API key
   - `POSTGRES_PASSWORD` — postgres superuser password (for local dev only)

## Worker Problem on Vercel

Vercel serverless functions cannot run long-running Kafka consumers. The three workers (`relay`, `search-sync`, `notification`) need a home:

**Option A: $5/month VPS** (DigitalOcean, Hetzner, etc.)
- Run Docker Compose with just the 3 workers + local PostgreSQL/Kafka/OpenSearch replaced by Aiven endpoints
- Workers connect to Aiven services over the internet
- Full event-driven architecture preserved

**Option B: Vercel Cron + Serverless** (free, but polling-based)
- Replace workers with scheduled serverless functions
- `/api/cron/outbox-relay` — polls outbox_events, publishes to Kafka (every minute)
- `/api/cron/search-sync` — polls Kafka, upserts to OpenSearch (every 5 minutes)
- `/api/cron/notifications` — polls notifications, sends emails (every minute)
- Trade-off: not truly event-driven, but works on the free tier

**Recommendation for hackathon demo**: Option B (Vercel Cron). No extra cost, everything on Vercel. The event-driven story is preserved conceptually; the workers run on a schedule instead of continuously.

## Files to Change

1. **`.env`** (root, not committed) — Add real values:
   - `PULSECART_APP_PASSWORD`
   - `OPENSEARCH_ADMIN_PASSWORD`
   - `ADMIN_KEY`
   - Aiven connection strings (replace localhost values)

2. **`docker-compose.yml`** — Two modes:
   - **Local dev**: Keep local PostgreSQL/Kafka/OpenSearch (current setup)
   - **Aiven**: Point backend at Aiven endpoints; remove local data services

3. **`vercel.json`** — Multi-service config (frontend + backend)
   - Backend needs `DATABASE_URL`, `OPENSEARCH_URL`, `KAFKA_BOOTSTRAP` as Vercel env vars
   - Workers not included (see Option B above)

4. **`backend/app/connections.py`** — Already supports HTTPS + auth for OpenSearch

## Verification Steps

1. Create Aiven services in the console
2. Download CA certs from Aiven
3. Add credentials to root `.env`
4. Run `docker compose up -d --build` (local dev still works)
5. Deploy to Vercel with `vercel --prod`
6. Set Vercel env vars from `.env` values
7. Run Playwright tests against the deployed frontend

## Aiven Connection Details (from your message)

| Service | Host | Port | User | Notes |
|---------|------|------|------|-------|
| PostgreSQL | pulsecart-12115-phoenixeyev5-11e7.h.aivencloud.com | 27571 | avnadmin | database: defaultdb, SSL required |
| OpenSearch | pulsecart-os-12115-phoenixeyev5-11e7.d.aivencloud.com | 27571 | avnadmin | HTTPS, auth required |
| Kafka | (from Aiven console) | — | — | SSL/SASL required |

PG_DSN format for Aiven:
```
postgresql://avnadmin:<password>@pulsecart-12115-phoenixeyev5-11e7.h.aivencloud.com:27571/defaultdb?sslmode=require
```

OPENSEARCH_URL format for Aiven:
```
https://avnadmin:<password>@pulsecart-os-12115-phoenixeyev5-11e7.d.aivencloud.com:27571
```

## Cost Summary

| Tier | PostgreSQL | Kafka | OpenSearch | Total |
|------|-----------|-------|-----------|-------|
| Aiven Free | ✅ Included | ✅ Included | ✅ Included | $0 |
| Aiven Startup | ~$19/mo | ~$29/mo | ~$29/mo | ~$77/mo |
| Vercel Hobby | — | — | — | $0 |

**Free tier is sufficient for the hackathon demo.**
