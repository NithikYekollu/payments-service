# FinServ Co — Payments Service

Core payment processing microservice handling transfers, webhooks, refunds, and ledger operations for FinServ Co's platform.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  API Gateway │────>│  Payments    │────>│ Stripe   │
│              │     │  Service     │     │ API      │
└──────────────┘     │              │     └──────────┘
                     │  Express.js  │
                     │  + PostgreSQL│────>┌──────────┐
                     │  + Redis     │     │ Webhooks │
                     └──────────────┘     └──────────┘
```

## Setup

```bash
npm install
cp .env.example .env  # Configure your env vars
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/transfers` | Initiate a bank transfer |
| POST | `/api/v1/payments` | Process a payment |
| POST | `/api/v1/refunds` | Issue a refund |
| GET | `/api/v1/transactions/:id` | Get transaction details |
| POST | `/api/v1/webhooks/stripe` | Handle Stripe webhooks |
| GET | `/api/v1/ledger/balance/:accountId` | Get account balance |
| POST | `/api/v1/ledger/reconcile` | Trigger reconciliation |

## Environment Variables

See `.env.example` for required configuration.
