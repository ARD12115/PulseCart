-- Add consumer_status to outbox_events for Kafka event streaming visualization.
ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS consumer_status TEXT
    NOT NULL DEFAULT 'pending'
    CHECK (consumer_status IN ('pending', 'synced', 'failed'));
CREATE INDEX IF NOT EXISTS outbox_consumer_status
  ON outbox_events (consumer_status);
