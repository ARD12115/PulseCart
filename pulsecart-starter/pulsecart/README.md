# PulseCart

Online store on Aiven PostgreSQL + Kafka + OpenSearch.

## Setup
1. Create ONE Aiven account for the team and share access.
2. Create a free PostgreSQL, Kafka and OpenSearch service.
3. Kafka: enable SASL/SSL access, download ca.pem, service.cert, service.key into `certs/` (git-ignored). Create topics `order.placed` and `inventory.changed`.
4. `cp .env.example .env` and fill in the connection details from the Aiven console.
5. Run `db/schema.sql` against PostgreSQL (psql or the Aiven query tool).
6. `cd backend && pip install -r requirements.txt`

## Flow
checkout (atomic stock decrement) -> order + outbox rows in one transaction -> relay publishes to Kafka -> consumers (notify, search-sync) -> OpenSearch index.
