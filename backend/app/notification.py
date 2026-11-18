"""Order confirmation consumer.

order.placed  ->  notifications row (status pending)  ->  sender loop  ->  email / log

Creating the row and recording the event as processed happen in one transaction, and
notifications.order_id is UNIQUE, so a redelivered event can never create a second
confirmation. The sender then delivers pending rows. Sending an email cannot be part of a
database transaction, so delivery is at-least-once: a crash between "SMTP accepted" and
"row marked sent" can send that one email again.

Without SMTP_HOST the confirmation is logged and stored (status "logged"), which is enough
for a demo and visible on the /admin page.
"""

import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv

from app.connections import PROJECT_ROOT, kafka_client_options, postgres_connection_kwargs
from app.resilience import configure_logging, handle_with_retry, safe_json_loads

load_dotenv(PROJECT_ROOT / ".env")

PG_DSN = os.getenv("PG_DSN")
CONSUMER_NAME = "notification"
SEND_INTERVAL = 2.0
SEND_BATCH = 20
MAX_SEND_ATTEMPTS = 5
log = logging.getLogger("pulsecart.notification")


def format_price(paise: int) -> str:
    return f"INR {paise / 100:,.2f}"


def build_confirmation(
    order_id: int, name: str, city: str, lines: list[dict], total_paise: int
) -> tuple[str, str]:
    subject = f"PulseCart order #{order_id} confirmed"
    rows = [
        f"  {line['qty']} x {line['name']} @ {format_price(line['price_paise'])}"
        for line in lines
    ]
    body = "\n".join(
        [
            f"Hi {name},",
            "",
            f"Thanks for your order #{order_id}. It is being prepared for delivery to {city}.",
            "",
            *rows,
            "",
            f"Total: {format_price(total_paise)}",
            "",
            "PulseCart",
        ]
    )
    return subject, body


async def create_notification(message, pool: asyncpg.Pool) -> None:
    payload = message.value
    if payload.get("_malformed") or "order_id" not in payload or "customer_id" not in payload:
        raise ValueError("order.placed event is missing order_id or customer_id")
    order_id = int(payload["order_id"])
    event_id = payload.get("outbox_event_id")
    async with pool.acquire() as conn:
        async with conn.transaction():
            if event_id is not None and await conn.fetchval(
                """SELECT EXISTS(SELECT 1 FROM processed_events
                   WHERE consumer = $1 AND event_id = $2)""",
                CONSUMER_NAME,
                event_id,
            ):
                return
            customer = await conn.fetchrow(
                "SELECT id, email, name FROM customers WHERE id = $1",
                int(payload["customer_id"]),
            )
            if customer is None:
                raise ValueError(f"customer {payload['customer_id']} does not exist")
            lines = [
                dict(row)
                for row in await conn.fetch(
                    """SELECT p.name, oi.qty, oi.price_paise
                       FROM order_items oi JOIN products p ON p.id = oi.product_id
                       WHERE oi.order_id = $1 ORDER BY p.name""",
                    order_id,
                )
            ]
            subject, body = build_confirmation(
                order_id,
                customer["name"],
                str(payload.get("city", "")),
                lines,
                int(payload.get("total_paise", 0)),
            )
            await conn.execute(
                """INSERT INTO notifications
                       (order_id, customer_id, recipient_email, subject, body)
                   VALUES ($1, $2, $3, $4, $5) ON CONFLICT (order_id) DO NOTHING""",
                order_id,
                customer["id"],
                customer["email"],
                subject,
                body,
            )
            if event_id is not None:
                await conn.execute(
                    """INSERT INTO processed_events (consumer, event_id)
                       VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                    CONSUMER_NAME,
                    event_id,
                )


def smtp_settings() -> dict | None:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        return None
    settings = {
        "host": host,
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "sender": os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "store@pulsecart.local",
        "starttls": os.getenv("SMTP_STARTTLS", "true").strip().lower() not in {"0", "false", "no"},
    }
    if settings["user"] and not settings["starttls"]:
        raise RuntimeError("SMTP_STARTTLS must be enabled when SMTP_USER is configured")
    return settings


def _send_smtp(settings: dict, row) -> None:
    email = EmailMessage()
    email["From"] = settings["sender"]
    email["To"] = row["recipient_email"]
    email["Subject"] = row["subject"]
    email.set_content(row["body"])
    with smtplib.SMTP(settings["host"], settings["port"], timeout=15) as smtp:
        if settings["starttls"]:
            smtp.starttls()
        if settings["user"]:
            smtp.login(settings["user"], settings["password"])
        smtp.send_message(email)


async def deliver(row) -> str:
    """Deliver one notification; returns the status to store ('sent' or 'logged')."""
    settings = smtp_settings()
    if settings is None:
        log.info(
            "ORDER CONFIRMATION (no SMTP configured) to=%s subject=%s",
            row["recipient_email"],
            row["subject"],
        )
        return "logged"
    if settings["user"] and not settings["starttls"]:
        raise RuntimeError("SMTP_STARTTLS must be enabled when SMTP_USER is configured")
    await asyncio.to_thread(_send_smtp, settings, row)
    return "sent"


async def send_pending(pool: asyncpg.Pool, send=deliver) -> int:
    """Deliver pending notifications; SMTP runs outside the DB transaction.

    Rows are claimed in a short transaction (FOR UPDATE SKIP LOCKED), then locks
    are released before the slow SMTP call. Outcomes are persisted in a second
    short transaction that only touches rows still pending, so a concurrent sender
    can never clobber an in-flight delivery.
    """
    claimed: list[dict] = []
    async with pool.acquire() as conn:
        async with conn.transaction():
            claimed = await conn.fetch(
                """SELECT id, recipient_email, subject, body, attempts
                   FROM notifications WHERE status = 'pending'
                   ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED""",
                SEND_BATCH,
            )

    if not claimed:
        return 0

    updates: list[tuple] = []
    for row in claimed:
        attempts = row["attempts"] + 1
        try:
            status = await send(row)
            updates.append((row["id"], status, None, attempts))
        except Exception as exc:
            final_status = "failed" if attempts >= MAX_SEND_ATTEMPTS else "pending"
            updates.append(
                (row["id"], final_status, f"{type(exc).__name__}: {exc}"[:500], attempts)
            )
            log.warning("Notification %s failed (attempt %d): %s", row["id"], attempts, exc)

    async with pool.acquire() as conn:
        async with conn.transaction():
            for row_id, status, last_error, attempts in updates:
                await conn.execute(
                    """UPDATE notifications
                       SET status = $2, attempts = $3, last_error = $4,
                           sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
                       WHERE id = $1 AND status = 'pending'""",
                    row_id, status, attempts, last_error,
                )
    return len(claimed)


async def sender_loop(pool: asyncpg.Pool) -> None:
    while True:
        try:
            sent = await send_pending(pool)
            if sent < SEND_BATCH:
                await asyncio.sleep(SEND_INTERVAL)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Notification sender iteration failed")
            await asyncio.sleep(SEND_INTERVAL * 5)


async def main() -> None:
    configure_logging()
    smtp_settings()  # Fail at startup rather than retrying mail with unsafe SMTP settings.
    if not PG_DSN:
        raise RuntimeError("PG_DSN is not configured")
    pool = await asyncpg.create_pool(
        PG_DSN, min_size=1, max_size=4, **postgres_connection_kwargs()
    )
    consumer = AIOKafkaConsumer(
        "order.placed",
        **kafka_client_options(),
        group_id=CONSUMER_NAME,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=safe_json_loads,
    )
    sender = asyncio.create_task(sender_loop(pool))
    try:
        await consumer.start()
        log.info("Notification consumer started")
        async for message in consumer:
            await handle_with_retry(
                message, lambda m: create_notification(m, pool), pool, CONSUMER_NAME
            )
            await consumer.commit()
    finally:
        sender.cancel()
        await asyncio.gather(sender, return_exceptions=True)
        await consumer.stop()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
