# Crown Penthouse Acquisition Deployment

The application uses NOWPayments for the $80 USD application fee. Payment completion is accepted only from a signed IPN callback and a matching server-to-server payment lookup. Applicant records and uploaded documents are stored in MySQL; document files remain private on the API server.

## Database

Create the database and apply the schema:

```sql
CREATE DATABASE crown_penthouse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
mysql -u root -p crown_penthouse < database/acquisition-schema.sql
```

The API also ensures the tables on startup. Existing legacy tables are left untouched.

## Environment

Copy `.env.example` to `.env.local`. Set database credentials, NOWPayments credentials, and public URLs:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crown_penthouse
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
PUBLIC_APP_URL=https://your-public-frontend.example
API_PUBLIC_URL=https://your-public-api.example
APPLICATION_FEE_USD=80
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_IPN_SECRET=your_nowpayments_ipn_secret
```

In the NOWPayments account, configure the same IPN secret. `API_PUBLIC_URL` must be a publicly reachable HTTPS API address so NOWPayments can deliver callbacks. For local tests, expose the API through a secure tunnel and use that public URL. Do not put secret values in `VITE_` variables or commit `.env.local`.

## Administrator setup

Create an administrator once using PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="use-a-new-unique-password-of-at-least-12-characters"
npm run admin:create
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_PASSWORD
```

Passwords are salted and hashed with Node `scrypt`. Admin sessions use HttpOnly cookies.

## Run locally

```bash
npm run dev:all
```

Or run `npm run dev:server` and `npm run dev` in separate terminals. Open `http://localhost:5173`.

## Payment lifecycle

1. Applicant completes and submits the concierge application.
2. Applicant chooses BTC, ETH, SOL, or USDT TRC20 and starts an $80 USD NOWPayments invoice.
3. The API saves the order and redirects the applicant to the hosted invoice checkout.
4. NOWPayments sends an IPN callback to `/api/payments/nowpayments/ipn`.
5. The API validates the `x-nowpayments-sig` HMAC using the configured IPN secret, fetches the payment directly from NOWPayments, and checks order ID, currency, USD amount, and `finished` status.
6. A matching payment changes the applicant to `PAYMENT VERIFIED`; only then can the applicant upload documents and use tenant portal features.
7. The authenticated admin dashboard shows applicant name/email, payment status, and document links. Document downloads require the admin session.

A success redirect alone never unlocks the portal. Only the verified IPN path does.

## Document handling

Uploads accept PDF, JPEG, or PNG up to 5 MB and require the applicant's private access token plus verified payment. Files are stored under `private-uploads/`, outside the public directory. Back up this directory securely and restrict server filesystem access.

## Production requirements

- Use HTTPS for the frontend and API.
- Configure real production NOWPayments credentials and the matching IPN secret.
- Ensure NOWPayments can reach the API callback URL.
- Keep the API and MySQL on trusted infrastructure; never publish `private-uploads/` as static content.
- Configure backups and retention rules for applicant identity/financial documents.
- Test IPN signature validation and payment lifecycle in the NOWPayments sandbox before accepting live payments.
