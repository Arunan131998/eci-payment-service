require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool } = require('../src/db/pool');

function datasetPath() {
  return process.env.ECI_DATASET_DIR || path.resolve(__dirname, '..', 'data');
}

function loadCsv(fileName) {
  const filePath = path.join(datasetPath(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
}

async function seedPayments() {
  const rows = loadCsv('eci_payments_indian.csv');

  for (const row of rows) {
    const orderId = String(row.order_id);
    const amount = Number(row.amount || 0);
    const method = row.method || 'UNKNOWN';
    const status = row.status || 'FAILED';
    const createdAt = row.created_at || null;

    await pool.query(
      `INSERT INTO payments
       (order_id, amount, method, status, reference, operation_type, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'CHARGE', $6, COALESCE($7::timestamp, NOW()), NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        orderId,
        amount,
        method,
        status,
        `SEED_CH_${row.payment_id}`,
        `seed-payment-${row.payment_id}`,
        createdAt
      ]
    );
  }

  console.log(`Seeded payments rows processed: ${rows.length}`);
}

async function run() {
  try {
    await seedPayments();
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Payment seed failed:', error.message);
  process.exit(1);
});
