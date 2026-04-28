# Payment Service

ECI Payment microservice implementing idempotent charge/refund flows with DB-per-service.

## Features
- Versioned API: `/v1/payments`
- Idempotent operations via `Idempotency-Key`
- Standard error format: `code`, `message`, `correlationId`
- Pagination/filtering on list API
- OpenAPI docs at `/docs`
- Metrics at `/metrics`

## Local Run (No Docker)
1. Ensure PostgreSQL is running and `payment_db` exists.
2. Create `.env` from `.env.example`.
3. Install and run:
   - `npm install`
   - `npm run seed` (optional, uses `data/eci_payments_indian.csv`)
   - `npm start`

## Important Endpoints
- `GET /health`
- `POST /v1/payments/charge`
- `POST /v1/payments/{paymentId}/refund`
- `GET /v1/payments?page=1&limit=10&order_id=ORD-1001`

## Postman
Import:
- `postman/payment-service.postman_collection.json`
- `postman/payment-service.postman_environment.json`

Select environment: `ECI Payment Local`

### Runner Order
1. `Health - Payment`
2. `Charge Payment (Idempotent)`
3. `List Payments`
4. `Refund Payment (Idempotent)`

The collection auto-saves `paymentId` from charge response for refund flow.

## Kubernetes (Minikube)
Apply manifests:
- `k8s/payment-config.yaml`
- `k8s/payment-db.yaml`
- `k8s/payment-service.yaml`
