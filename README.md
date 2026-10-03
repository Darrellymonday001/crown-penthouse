# Crown Penthouse Acquisition Portal

A React/Vite concierge application with a MySQL-backed Express API, authenticated sales dashboard, NOWPayments crypto checkout, provider-verified payment status, and private document review.

## Setup

1. Create the MySQL database and apply `database/acquisition-schema.sql` (the API also ensures tables on startup).
2. Copy `.env.example` to `.env.local`; configure database credentials, NOWPayments API key, IPN secret, and publicly reachable frontend/API URLs.
3. Create the first admin using the `npm run admin:create` instructions in [DEPLOYMENT.md](DEPLOYMENT.md).
4. Run `npm run dev:all` and visit `http://localhost:5173`.

## Application flow

- Applicant submits a private application and receives a tokenized portal URL.
- Applicant selects a supported currency and pays the $80 USD fee through a hosted invoice.
- The server verifies signed NOWPayments IPNs against the provider API before setting `PAYMENT VERIFIED`.
- Payment verification unlocks tenant document upload.
- Authenticated admins view applicant email, payment state, conversation history, and securely download submitted documents.

All credentials remain server-side. Uploaded documents are stored outside the public directory. See [DEPLOYMENT.md](DEPLOYMENT.md) for environment configuration and production requirements.
