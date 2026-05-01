const express = require('express');
const { pool } = require('../db/pool');
const { paymentsFailedTotal } = require('../metrics');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

router.post('/charge', async (req, res, next) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Idempotency-Key header is required' });
  }

  const { order_id, amount, method } = req.body;
  if (!order_id || !amount || !method) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'order_id, amount and method are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json(existing.rows[0]);
    }

    const shouldFail = req.header('x-fail-payment') === 'true';
    const status = shouldFail ? 'FAILED' : 'SUCCESS';
    const reference = `CH_${Date.now()}`;

    const inserted = await client.query(
      `INSERT INTO payments (order_id, amount, method, status, reference, operation_type, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [order_id, amount, method, status, reference, 'CHARGE', idempotencyKey]
    );

    if (status === 'FAILED') {
      paymentsFailedTotal.inc();
    }

    await client.query('COMMIT');
    const statusCode = status === 'SUCCESS' ? 201 : 402;
    return res.status(statusCode).json(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/:paymentId/refund', async (req, res, next) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Idempotency-Key header is required' });
  }

  const { paymentId } = req.params;
  const { amount } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json(existing.rows[0]);
    }

    const original = await client.query(
      `SELECT * FROM payments
       WHERE payment_id = $1 AND operation_type = 'CHARGE' AND status = 'SUCCESS'`,
      [paymentId]
    );

    if (original.rows.length === 0) {
      return next({ status: 404, code: 'PAYMENT_NOT_FOUND', message: 'Original successful payment not found' });
    }

    const refundAmount = amount || original.rows[0].amount;
    const reference = `RF_${Date.now()}`;

    const inserted = await client.query(
      `INSERT INTO payments (order_id, amount, method, status, reference, operation_type, original_payment_id, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        original.rows[0].order_id,
        refundAmount,
        original.rows[0].method,
        'REFUNDED',
        reference,
        'REFUND',
        paymentId,
        idempotencyKey
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);
  const filters = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    filters.push(`status = $${params.length}`);
  }
  if (req.query.order_id) {
    params.push(req.query.order_id);
    filters.push(`order_id = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const countQuery = `SELECT COUNT(*)::INT AS total FROM payments ${whereClause}`;
    const dataQuery = `
      SELECT * FROM payments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const totalResult = await pool.query(countQuery, params);
    const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

    return res.json({
      page,
      limit,
      total: totalResult.rows[0].total,
      items: dataResult.rows
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:paymentId', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE payment_id = $1',
      [req.params.paymentId]
    );
    if (!result.rows.length) {
      return next({ status: 404, code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
