CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(64) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reference VARCHAR(120),
  operation_type VARCHAR(20) NOT NULL,
  original_payment_id UUID,
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
