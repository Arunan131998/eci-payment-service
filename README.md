# Payment Service

ECI Payment microservice implementing idempotent charge/refund flows with DB-per-service.

## Features
- Versioned API: `/v1/payments`
- Idempotent operations via `Idempotency-Key`
- Order callback integration via `ORDER_CALLBACK_URL` to update order payment status
- Notification callback integration via `NOTIFICATION_BASE_URL` for payment events
- Standard error format: `code`, `message`, `correlationId`
- Pagination/filtering on list API
- OpenAPI docs at `/docs`
- Metrics at `/metrics`

## Quick Start

### Option 1: Local Development (No Docker)
1. Ensure PostgreSQL is running and `payment_db` exists.
2. Create `.env` from `.env.example`.
3. Run:
   ```bash
   npm install
   npm run seed  # optional - loads data/eci_payments_indian.csv
   npm start
   ```
4. Service runs on `http://localhost:3004`

### Option 2: Docker (Single Service)
1. Build the Docker image:
   ```bash
   docker build -t eci-payment-service:latest .
   ```
2. Create Docker network (if not exists):
   ```bash
   docker network create eci-net
   ```
3. Run PostgreSQL container:
   ```bash
   docker run -d --name payment-db --network eci-net \
     -e POSTGRES_USER=user \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=payment_db \
     -p 5434:5432 \
     postgres:16-alpine
   ```
4. Run the service container:
   ```bash
   docker run -d --name payment-service --network eci-net \
     -e DATABASE_URL=postgres://user:password@payment-db:5432/payment_db \
     -e APP_PORT=3004 \
     -p 3004:3004 \
     eci-payment-service:latest
   ```
5. Verify running:
   ```bash
   curl http://localhost:3004/health
   ```

### Option 3: Docker Compose (Full Stack - from root directory)
From the `FullApplication/` root directory:
```bash
# Build all services and start the stack
docker compose -f docker-compose.yml up --build -d

# View logs
docker compose -f docker-compose.yml logs -f payment-service

# Stop all services
docker compose -f docker-compose.yml down
```

### Seeding (PowerShell)
Run from the `FullApplication/` root directory:
```powershell
# Seed only payment service
docker compose -f docker-compose.yml exec payment-service npm run seed
```

## Important Endpoints
- `GET /health` — Health check
- `POST /v1/payments/charge` — Charge payment (idempotent via Idempotency-Key)
- `POST /v1/payments/{paymentId}/refund` — Refund payment (idempotent)
- `GET /v1/payments?page=1&limit=10&order_id=ORD-1001` — List payments with pagination/filtering
- `GET /docs` — OpenAPI Swagger UI
- `GET /metrics` — Prometheus metrics

## Postman Testing
Import from `postman/` directory:
- `payment-service.postman_collection.json`
- `payment-service.postman_environment.json`

Select environment: `ECI Payment Local`

#### Test Runner Order
1. Health - Payment
2. Charge Payment (Idempotent)
3. List Payments
4. Refund Payment (Idempotent)

The collection auto-saves `paymentId` from charge response for refund flow.

## Kubernetes Deployment (Minikube)

### Prerequisites
- Minikube running: `minikube start`
- kubectl configured
- Image available in Minikube

### Deployment Steps

1. **Build image for Minikube**:
   ```bash
   eval $(minikube docker-env)
   docker build -t eci-payment-service:latest .
   ```

2. **Apply Kubernetes manifests** (from service root):
   ```bash
   kubectl apply -f k8s/payment-config.yaml
   kubectl apply -f k8s/payment-db.yaml
   kubectl rollout status statefulset/payment-db
   kubectl apply -f k8s/payment-service.yaml
   kubectl rollout status deployment/payment-service
   ```

3. **Verify deployment**:
   ```bash
   kubectl get pods -l app=payment-service
   kubectl get svc payment-service
   kubectl logs -l app=payment-service -f
   ```

4. **Access the service** (port-forward):
   ```bash
   kubectl port-forward svc/payment-service 3004:3004
   curl http://localhost:3004/health
   # Open browser: http://localhost:3004/docs
   ```

5. **Cleanup**:
   ```bash
   kubectl delete -f k8s/payment-service.yaml
   kubectl delete -f k8s/payment-db.yaml
   kubectl delete -f k8s/payment-config.yaml
   ```
