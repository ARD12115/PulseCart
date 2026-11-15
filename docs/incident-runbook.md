# Incident runbook

Use this guide for a suspected outage, incorrect order or inventory state, exposed credential, or customer-data incident. Assign an incident lead and keep a timestamped record of observations and actions. Do not paste credentials, order access codes, or customer data into tickets or chat.

## 1. Triage

1. Record when the issue began, affected routes/services, user impact, and the most recent deployment or configuration change.
2. Check the storefront and `GET /health`. In Compose, inspect service state with `docker compose ps` and recent logs with `docker compose logs --since=15m backend relay search-sync notification postgres kafka opensearch`.
3. Preserve relevant logs and provider status pages before restarting services. Avoid repeatedly restarting a service that may be losing data or replaying work.
4. If orders, inventory, or customer data may be incorrect, stop checkout writes by stopping the backend and notify the incident lead before continuing:

   ```powershell
   docker compose stop backend
   ```

## 2. Service outage

- **API or database unavailable:** check `/health`, backend/PostgreSQL logs, connection settings, and provider status. Do not delete the PostgreSQL volume. Restore service only after the database is healthy and the API can read it.
- **Kafka backlog or consumer failure:** inspect relay/worker logs, topic availability, and `/admin/dead-letters`. Preserve dead-letter records; do not mark or delete events as handled just to clear an alert.
- **Search unavailable:** verify OpenSearch health and the search-sync worker. PostgreSQL remains the order and inventory source of truth. Restore search synchronization, then verify product results.
- **Email delivery failure:** inspect notification statuses and SMTP configuration. Do not retry by inserting duplicate notification rows; the worker retries existing pending notifications.

## 3. Incorrect order or inventory state

1. Stop checkout writes if the issue could cause additional incorrect orders.
2. Preserve a database snapshot and relevant order/outbox IDs.
3. Compare the order, order items, inventory, and outbox records before making corrections. Use the admin view or a read-only database query first.
4. Make corrections in a reviewed transaction. Do not edit stock or mark outbox events published without confirming the corresponding event reached Kafka.
5. Resume checkout only after a second person or incident lead verifies the affected records and a new checkout succeeds safely.

## 4. Credential exposure

1. Treat any committed, logged, or shared credential as compromised, even if it is later deleted.
2. Rotate the affected credential at its provider: database password, `ADMIN_KEY`, Kafka certificates, OpenSearch credentials, or SMTP credentials.
3. Update deployment secrets and recreate the services that use the credential. For PostgreSQL, follow the existing-volume rotation procedure in the README; changing Compose environment variables alone does not change a database user's password.
4. Revoke exposed order access codes where possible and review access logs for suspicious use.
5. Remove the secret from the current source and prevent future commits. Coordinate any Git-history cleanup separately; history rewriting does not replace rotation.

## 5. Data restore

1. Stop writes to the affected database.
2. Identify the latest known-good encrypted backup and confirm its timestamp and integrity.
3. Restore it to a separate database first. Do not overwrite the only copy of the current database.
4. Validate schema, orders, inventory, and application connectivity against the restored database.
5. Have the incident lead approve the cutover, then retain the damaged database snapshot until recovery is confirmed.

Use the README's backup/restore commands for local Compose. For production, follow the managed database provider's recovery procedure and verify restore access before an incident.

## 6. Recovery and follow-up

1. Confirm health checks, checkout, inventory consistency, outbox processing, and customer-facing pages.
2. Resume stopped services and monitor logs and provider health closely.
3. Communicate impact and recovery through the project's designated support channel.
4. Record the timeline, root cause, data impact, recovery actions, and prevention work. Assign owners and due dates for follow-up items.

## Contacts and deployment-specific details

Before production launch, fill in the incident lead, escalation contacts, hosting/provider status links, backup location, restore owner, and customer communication channel for the deployed environment. This repository does not currently define an on-call rotation or external alerting provider.
