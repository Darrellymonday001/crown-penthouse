import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = (
  process.env.FRONTEND_URL || 'http://localhost:5173'
).replace(/\/$/, '');

const PUBLIC_APP_URL = (
  process.env.PUBLIC_APP_URL || FRONTEND_URL
).replace(/\/$/, '');

const API_PUBLIC_URL = (
  process.env.API_PUBLIC_URL ||
  'https://crown-penthouse-api.onrender.com'
).replace(/\/$/, '');

const NOWPAYMENTS_API_KEY =
  process.env.NOWPAYMENTS_API_KEY || '';

const NOWPAYMENTS_IPN_SECRET =
  process.env.NOWPAYMENTS_IPN_SECRET || '';

const APPLICATION_FEE_USD = Number(
  process.env.APPLICATION_FEE_USD || 80
);

const ADMIN_SESSION_HOURS = Number(
  process.env.ADMIN_SESSION_HOURS || 8
);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const uploadDirectory =
  process.env.PRIVATE_UPLOAD_DIR ||
  path.join(__dirname, '..', 'private-uploads');

const allowedOrigins = new Set([
  FRONTEND_URL,
  'https://crownpenthousecollection.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (
          !IS_PRODUCTION &&
          /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        )
      ) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Nowpayments-Sig',
    ],
  })
);

app.use(express.json({ limit: '2mb' }));

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb',
  })
);

/* ============================================================
   GENERAL HELPERS
   ============================================================ */

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const sha256 = (value) =>
  crypto.createHash('sha256')
    .update(String(value))
    .digest('hex');

const timingSafeEqualHex = (a, b) => {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    a.length !== b.length ||
    a.length % 2 !== 0
  ) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, 'hex'),
      Buffer.from(b, 'hex')
    );
  } catch {
    return false;
  }
};

const clean = (value, max = 255) =>
  String(value ?? '').trim().slice(0, max);

const validEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const makeApplicationId = () =>
  `CP${Date.now().toString(36).toUpperCase()}${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`.slice(0, 32);

const makeAccessToken = () =>
  crypto.randomBytes(32).toString('hex');

const getBearerToken = (req) => {
  const value = req.headers.authorization || '';

  return value.startsWith('Bearer ')
    ? value.slice(7).trim()
    : '';
};

const parseJson = (value, fallback = []) => {
  if (
    Array.isArray(value) ||
    (value && typeof value === 'object')
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const moneyEqual = (a, b) =>
  Number.isFinite(Number(a)) &&
  Number.isFinite(Number(b)) &&
  Math.abs(Number(a) - Number(b)) < 0.02;

/* ============================================================
   DATABASE SCHEMA HELPERS
   ============================================================ */


async function columnExists(tableName, columnName) {
    const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

return rows.length > 0;
}


async function addColumnIfMissing(
  table,
  column,
  definition
) {
  if (!(await columnExists(table, column))) {
    await pool.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    );
  }
}

/* ============================================================
   DATABASE INITIALIZATION
   ============================================================ */

async function ensureSchema() {
  /*
   * Unpaid applicant details are stored in this temporary table.
   * The final applications table is populated only after payment
   * is verified by the server.
   */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_application_sessions (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      access_token_hash CHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      residence VARCHAR(255) DEFAULT NULL,
      budget_range VARCHAR(120) DEFAULT NULL,
      purchase_intent VARCHAR(120) DEFAULT NULL,
      payment_preference VARCHAR(80) DEFAULT 'NOWPayments',
      current_address TEXT NOT NULL,
      desired_move_in_date DATE NOT NULL,
      employment_status VARCHAR(100) NOT NULL,
      conversation_history JSON DEFAULT NULL,
      session_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_PAYMENT',
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pending_email (email),
      INDEX idx_pending_status (session_status)
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * Keep existing applications and add missing columns.
   */

  await addColumnIfMissing(
    'applications',
    'current_address',
    'TEXT NULL'
  );

  await addColumnIfMissing(
    'applications',
    'desired_move_in_date',
    'DATE NULL'
  );

  await addColumnIfMissing(
    'applications',
    'employment_status',
    'VARCHAR(100) NULL'
  );

  await addColumnIfMissing(
    'applications',
    'conversation_history',
    'JSON NULL'
  );

  await addColumnIfMissing(
    'applications',
    'access_token_hash',
    'CHAR(64) NULL'
  );

  await addColumnIfMissing(
    'applications',
    'residence',
    'VARCHAR(255) NULL'
  );

  await addColumnIfMissing(
    'applications',
    'budget_range',
    'VARCHAR(120) NULL'
  );

  await addColumnIfMissing(
    'applications',
    'purchase_intent',
    'VARCHAR(120) NULL'
  );

  await addColumnIfMissing(
    'applications',
    'payment_preference',
    "VARCHAR(80) DEFAULT 'NOWPayments'"
  );

  await addColumnIfMissing(
    'applications',
    'application_status',
    "VARCHAR(40) NOT NULL DEFAULT 'NEW'"
  );

  await addColumnIfMissing(
    'applications',
    'payment_status',
    "VARCHAR(40) NOT NULL DEFAULT 'NOT REQUESTED'"
  );

  await addColumnIfMissing(
    'applications',
    'sales_representative',
    "VARCHAR(255) DEFAULT 'Crown Sales Concierge'"
  );

  /*
   * Payment orders must support a pending session before the
   * final application record exists.
   */

  await addColumnIfMissing(
    'payment_orders',
    'pending_session_id',
    'VARCHAR(32) NULL'
  );

  const [paymentAppCol] = await pool.execute(
    "SHOW COLUMNS FROM payment_orders LIKE 'application_id'"
  );

  if (
    paymentAppCol.length &&
    String(paymentAppCol[0].Null).toUpperCase() !== 'YES'
  ) {
    await pool.query(
      'ALTER TABLE payment_orders MODIFY COLUMN application_id VARCHAR(32) NULL'
    );
  }

  await addColumnIfMissing(
    'payment_orders',
    'invoice_id',
    'VARCHAR(100) NULL'
  );

  await addColumnIfMissing(
    'payment_orders',
    'payment_id',
    'VARCHAR(100) NULL'
  );

  await addColumnIfMissing(
    'payment_orders',
    'payment_status',
    "VARCHAR(40) NOT NULL DEFAULT 'WAITING'"
  );

  await addColumnIfMissing(
    'payment_orders',
    'price_amount',
    'DECIMAL(12,2) NULL'
  );

  await addColumnIfMissing(
    'payment_orders',
    'price_currency',
    "VARCHAR(10) NOT NULL DEFAULT 'USD'"
  );

  await addColumnIfMissing(
    'payment_orders',
    'pay_currency',
    'VARCHAR(30) NULL'
  );

  const [payCurrencyCol] = await pool.execute(
    "SHOW COLUMNS FROM payment_orders LIKE 'pay_currency'"
  );

  if (
    payCurrencyCol.length &&
    String(payCurrencyCol[0].Null).toUpperCase() !== 'YES'
  ) {
    await pool.query(
      'ALTER TABLE payment_orders MODIFY COLUMN pay_currency VARCHAR(30) NULL'
    );
  }

  await addColumnIfMissing(
    'payment_orders',
    'invoice_url',
    'TEXT NULL'
  );

  await addColumnIfMissing(
    'payment_orders',
    'provider_payload',
    'JSON NULL'
  );

  /*
   * Admin sessions.
   */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_sessions_admin (admin_id),
      CONSTRAINT fk_admin_sessions_user
        FOREIGN KEY (admin_id)
        REFERENCES admin_users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * Applicant document metadata.
   */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applicant_documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      application_id VARCHAR(32) NOT NULL,
      document_type VARCHAR(100) NOT NULL DEFAULT 'supporting_document',
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_documents_application (application_id),
      CONSTRAINT fk_applicant_documents_application
        FOREIGN KEY (application_id)
        REFERENCES applications(application_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  /*
   * Add missing columns to older installations.
   */

  await addColumnIfMissing(
    'admin_sessions',
    'token_hash',
    'CHAR(64) NULL'
  );

  await addColumnIfMissing(
    'admin_sessions',
    'expires_at',
    'DATETIME NULL'
  );

  await addColumnIfMissing(
    'admin_sessions',
    'created_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );

  await addColumnIfMissing(
    'applicant_documents',
    'document_type',
    "VARCHAR(100) NOT NULL DEFAULT 'supporting_document'"
  );

  await addColumnIfMissing(
    'applicant_documents',
    'original_name',
    "VARCHAR(255) NOT NULL DEFAULT ''"
  );

  await addColumnIfMissing(
    'applicant_documents',
    'stored_name',
    "VARCHAR(255) NOT NULL DEFAULT ''"
  );

  await addColumnIfMissing(
    'applicant_documents',
    'mime_type',
    "VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream'"
  );

  await addColumnIfMissing(
    'applicant_documents',
    'file_size',
    'BIGINT UNSIGNED NOT NULL DEFAULT 0'
  );

  await addColumnIfMissing(
    'applicant_documents',
    'file_path',
    'TEXT NULL'
  );

  await addColumnIfMissing(
    'applicant_documents',
    'uploaded_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
  );
}

/* ============================================================
   NOWPAYMENTS SIGNATURE VERIFICATION
   ============================================================ */

function sortedObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortedObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = sortedObject(value[key]);
        return out;
      }, {});
  }

  return value;
}

function verifyNowPaymentsSignature(body, signature) {
  if (!NOWPAYMENTS_IPN_SECRET || !signature) {
    return false;
  }

  const canonical = JSON.stringify(sortedObject(body));

  const expected = crypto
    .createHmac('sha512', NOWPAYMENTS_IPN_SECRET)
    .update(canonical)
    .digest('hex');

  return timingSafeEqualHex(
    expected.toLowerCase(),
    String(signature).toLowerCase()
  );
}

/* ============================================================
   NOWPAYMENTS API HELPER
   ============================================================ */

async function nowPaymentsRequest(endpoint, options = {}) {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error(
      'NOWPAYMENTS_API_KEY is not configured on the server.'
    );
  }

  const response = await fetch(
    `https://api.nowpayments.io/v1${endpoint}`,
    {
      method: options.method || 'GET',

      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },

      body: options.body
        ? JSON.stringify(options.body)
        : undefined,
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload.message ||
      payload.msg ||
      `NOWPayments returned HTTP ${response.status}`;

    const error = new Error(message);
    error.status = 502;

    throw error;
  }

  return payload;
}

/* ============================================================
   APPLICATION LOOKUP
   ============================================================ */

async function getPendingOrFinalApplication(
  applicationId,
  token
) {
  if (!applicationId || !token) {
    return null;
  }

  const tokenHash = sha256(token);

  const [finalRows] = await pool.execute(
    `SELECT *
     FROM applications
     WHERE application_id = ?
       AND access_token_hash = ?
     LIMIT 1`,
    [applicationId, tokenHash]
  );

  if (finalRows[0]) {
    return {
      kind: 'final',
      row: finalRows[0],
    };
  }

  const [pendingRows] = await pool.execute(
    `SELECT *
     FROM pending_application_sessions
     WHERE id = ?
       AND access_token_hash = ?
     LIMIT 1`,
    [applicationId, tokenHash]
  );

  if (pendingRows[0]) {
    return {
      kind: 'pending',
      row: pendingRows[0],
    };
  }

  return null;
}

/* ============================================================
   PUBLIC APPLICATION RESPONSE
   ============================================================ */

function publicApplication(row, kind = 'final') {
  const id =
    kind === 'pending'
      ? row.id
      : row.application_id;

  return {
    applicationId: id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    residence: row.residence || null,
    budgetRange: row.budget_range || null,
    purchaseIntent: row.purchase_intent || null,
    paymentPreference:
      row.payment_preference || 'NOWPayments',
    currentAddress: row.current_address || null,
    desiredMoveInDate: row.desired_move_in_date || null,
    employmentStatus: row.employment_status || null,

    applicationStatus:
      row.application_status ||
      (kind === 'pending' ? 'AWAITING PAYMENT' : 'NEW'),

    paymentStatus:
      row.payment_status ||
      (kind === 'pending' ? 'NOT PAID' : 'NOT REQUESTED'),

    salesRepresentative:
      row.sales_representative || 'Crown Sales Concierge',

    createdAt: row.created_at,

    conversationHistory: parseJson(
      row.conversation_history,
      []
    ),
  };
}

function publicPaymentOrder(row) {
  if (!row) {
    return null;
  }

  return {
    orderId: row.order_id,
    invoiceId: row.invoice_id || null,
    paymentId: row.payment_id || null,
    paymentStatus: row.payment_status,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    payCurrency: row.pay_currency || null,
    invoiceUrl: row.invoice_url || null,
  };
}

async function getLatestPaymentOrder(
  applicationId,
  kind
) {
  const column =
    kind === 'pending'
      ? 'pending_session_id'
      : 'application_id';

  const [rows] = await pool.execute(
    `SELECT *
     FROM payment_orders
     WHERE ${column} = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [applicationId]
  );

  return rows[0] || null;
}

/* ============================================================
   FINALIZE APPLICATION AFTER VERIFIED PAYMENT
   ============================================================ */

async function createFinalApplicationFromPaidSession(
  connection,
  pending,
  paymentOrder,
  providerPayment
) {
  const [existing] = await connection.execute(
    `SELECT id
     FROM applications
     WHERE application_id = ?
     LIMIT 1`,
    [pending.id]
  );

  /*
   * Idempotency: do not create the same application twice.
   */

  if (existing.length) {
    await connection.execute(
      `UPDATE payment_orders
       SET application_id = ?,
           payment_id = ?,
           payment_status = 'FINISHED',
           pay_currency = ?,
           provider_payload = ?
       WHERE id = ?`,
      [
        pending.id,
        String(
          providerPayment.payment_id ||
          paymentOrder.payment_id ||
          ''
        ),
        providerPayment.pay_currency || null,
        JSON.stringify(providerPayment),
        paymentOrder.id,
      ]
    );

    await connection.execute(
      `UPDATE applications
       SET payment_status = 'PAYMENT VERIFIED',
           application_status = 'UNDER REVIEW'
       WHERE application_id = ?`,
      [pending.id]
    );

    await connection.execute(
      `UPDATE pending_application_sessions
       SET session_status = 'PAID'
       WHERE id = ?`,
      [pending.id]
    );

    return;
  }

  await connection.execute(
    `INSERT INTO applications (
      application_id,
      access_token_hash,
      name,
      email,
      phone,
      residence,
      budget_range,
      purchase_intent,
      payment_preference,
      current_address,
      desired_move_in_date,
      employment_status,
      conversation_history,
      application_status,
      payment_status,
      sales_representative,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      'UNDER REVIEW',
      'PAYMENT VERIFIED',
      'Crown Sales Concierge',
      NOW(),
      NOW()
    )`,
    [
      pending.id,
      pending.access_token_hash,
      pending.name,
      pending.email,
      pending.phone,
      pending.residence,
      pending.budget_range,
      pending.purchase_intent,
      'NOWPayments',
      pending.current_address,
      pending.desired_move_in_date,
      pending.employment_status,
      JSON.stringify(
        parseJson(pending.conversation_history, [])
      ),
    ]
  );

  /*
   * Preserve conversation history if the table exists.
   */

  const history = parseJson(
    pending.conversation_history,
    []
  );

  if (Array.isArray(history) && history.length) {
    for (const item of history) {
      const sender = [
        'applicant',
        'concierge',
        'admin',
      ].includes(item?.sender)
        ? item.sender
        : 'applicant';

      const message = clean(item?.message, 5000);

      if (!message) {
        continue;
      }

      await connection.execute(
        `INSERT INTO conversation_messages
          (application_id, sender, message, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          pending.id,
          sender,
          message,
          item?.createdAt
            ? new Date(item.createdAt)
            : new Date(),
        ]
      ).catch(() => {
        /*
         * The JSON conversation history is preserved even if
         * this optional table differs from the expected schema.
         */
      });
    }
  }

  await connection.execute(
    `UPDATE payment_orders
     SET application_id = ?,
         payment_id = ?,
         payment_status = 'FINISHED',
         pay_currency = ?,
         provider_payload = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      pending.id,
      String(
        providerPayment.payment_id ||
        paymentOrder.payment_id ||
        ''
      ),
      providerPayment.pay_currency || null,
      JSON.stringify(providerPayment),
      paymentOrder.id,
    ]
  );

  await connection.execute(
    `UPDATE pending_application_sessions
     SET session_status = 'PAID'
     WHERE id = ?`,
    [pending.id]
  );
}

/* ============================================================
   HEALTH CHECK
   ============================================================ */

app.get(
  '/health',
  asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');

    res.json({ ok: true });
  })
);

/* ============================================================
   CREATE PENDING APPLICATION SESSION
   ============================================================ */

/*
 * This endpoint temporarily saves applicant information.
 * It does NOT insert into the final applications table.
 *
 * Required fields:
 * name, email, phone, currentAddress,
 * desiredMoveInDate, employmentStatus.
 */

app.post(
  '/api/applications',
  asyncRoute(async (req, res) => {
    const body = req.body || {};

    const name = clean(body.name, 255);
    const email = clean(body.email, 255).toLowerCase();
    const phone = clean(body.phone, 60);

    const currentAddress = clean(
      body.currentAddress ?? body.current_address,
      2000
    );

    const desiredMoveInDate = clean(
      body.desiredMoveInDate ?? body.desired_move_in_date,
      10
    );

    const employmentStatus = clean(
      body.employmentStatus ?? body.employment_status,
      100
    );

    const residence =
      clean(body.residence, 255) || null;

    const budgetRange =
      clean(body.budgetRange ?? body.budget_range, 120) ||
      null;

    const purchaseIntent =
      clean(body.purchaseIntent ?? body.purchase_intent, 120) ||
      null;

    const conversationHistory =
      Array.isArray(body.conversationHistory)
        ? body.conversationHistory.slice(-100)
        : [];

    if (
      !name ||
      !validEmail(email) ||
      !phone ||
      !currentAddress ||
      !employmentStatus ||
      !/^\d{4}-\d{2}-\d{2}$/.test(desiredMoveInDate)
    ) {
      return res.status(400).json({
        message:
          'Full name, valid email, phone, current address, desired move-in date, and employment status are required.',
      });
    }

    const date = new Date(
      `${desiredMoveInDate}T00:00:00Z`
    );

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== desiredMoveInDate
    ) {
      return res.status(400).json({
        message: 'Please provide a valid desired move-in date.',
      });
    }

    const applicationId = makeApplicationId();
    const accessToken = makeAccessToken();

    const expiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    );

    await pool.execute(
      `INSERT INTO pending_application_sessions (
        id,
        access_token_hash,
        name,
        email,
        phone,
        residence,
        budget_range,
        purchase_intent,
        payment_preference,
        current_address,
        desired_move_in_date,
        employment_status,
        conversation_history,
        session_status,
        expires_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        'NOWPayments',
        ?, ?, ?, ?,
        'PENDING_PAYMENT',
        ?
      )`,
      [
        applicationId,
        sha256(accessToken),
        name,
        email,
        phone,
        residence,
        budgetRange,
        purchaseIntent,
        currentAddress,
        desiredMoveInDate,
        employmentStatus,
        JSON.stringify(conversationHistory),
        expiresAt,
      ]
    );

    res.status(201).json({
      applicationId,
      accessToken,
      status: 'PENDING_PAYMENT',
      message:
        'Application details saved temporarily. Complete payment to submit the application.',
    });
  })
);

/* ============================================================
   APPLICATION AND PAYMENT STATUS
   ============================================================ */

app.get(
  '/api/applications/:applicationId',
  asyncRoute(async (req, res) => {
    const auth = await getPendingOrFinalApplication(
      req.params.applicationId,
      getBearerToken(req)
    );

    if (!auth) {
      return res.status(404).json({
        message:
          'Application not found or access token is invalid.',
      });
    }

    if (
      auth.kind === 'pending' &&
      new Date(auth.row.expires_at).getTime() < Date.now() &&
      auth.row.session_status !== 'PAID'
    ) {
      return res.status(410).json({
        message:
          'This payment session has expired. Please begin a new application.',
      });
    }

    const payment = await getLatestPaymentOrder(
      req.params.applicationId,
      auth.kind
    );

    const finalPaid =
      auth.kind === 'final' &&
      String(auth.row.payment_status).toUpperCase() ===
        'PAYMENT VERIFIED';

    res.json({
      application: {
        ...publicApplication(auth.row, auth.kind),
        paymentOrder: publicPaymentOrder(payment),
        portalAccess: finalPaid,
        sessionStatus:
          auth.kind === 'pending'
            ? auth.row.session_status
            : 'PAID',
      },
    });
  })
);

/* ============================================================
   CREATE NOWPAYMENTS INVOICE
   ============================================================ */

app.post(
  '/api/applications/:applicationId/payment',
  asyncRoute(async (req, res) => {
    const applicationId = req.params.applicationId;

    const auth = await getPendingOrFinalApplication(
      applicationId,
      getBearerToken(req)
    );

    if (!auth) {
      return res.status(404).json({
        message:
          'Application not found or access token is invalid.',
      });
    }

    if (
      auth.kind === 'final' &&
      String(auth.row.payment_status).toUpperCase() ===
        'PAYMENT VERIFIED'
    ) {
      return res.json({
        alreadyPaid: true,
        portalAccess: true,
        applicationId,
      });
    }

    if (auth.kind !== 'pending') {
      return res.status(409).json({
        message:
          'This application cannot start a new payment.',
      });
    }

    if (auth.row.session_status === 'PAID') {
      return res.status(409).json({
        message: 'Payment has already been confirmed.',
      });
    }

    if (
      new Date(auth.row.expires_at).getTime() < Date.now()
    ) {
      return res.status(410).json({
        message:
          'This payment session has expired. Please start a new application.',
      });
    }

    if (
      !Number.isFinite(APPLICATION_FEE_USD) ||
      APPLICATION_FEE_USD <= 0
    ) {
      return res.status(500).json({
        message:
          'APPLICATION_FEE_USD is not configured correctly.',
      });
    }

    const existing = await getLatestPaymentOrder(
      applicationId,
      'pending'
    );

    if (
      existing?.invoice_url &&
      [
        'WAITING',
        'PENDING',
        'CONFIRMING',
      ].includes(
        String(existing.payment_status).toUpperCase()
      )
    ) {
      return res.json({
        invoiceUrl: existing.invoice_url,
        orderId: existing.order_id,
        paymentStatus: existing.payment_status,
      });
    }

    const orderId =
      `CP-${applicationId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const appUrl = PUBLIC_APP_URL;
    const apiUrl = API_PUBLIC_URL || appUrl;
    const accessToken = getBearerToken(req);

    const invoice = await nowPaymentsRequest(
      '/invoice',
      {
        method: 'POST',

        body: {
          price_amount: Number(
            APPLICATION_FEE_USD.toFixed(2)
          ),

          price_currency: 'usd',

          order_id: orderId,

          order_description:
            `Crown Penthouse Collection application fee - ${applicationId}`,

          ipn_callback_url:
            `${apiUrl}/api/payments/nowpayments/ipn`,

          success_url:
            `${appUrl}/tenant-portal.html?application=${encodeURIComponent(applicationId)}&access=${encodeURIComponent(accessToken)}&payment=success`,

          cancel_url:
            `${appUrl}/tenant-portal.html?application=${encodeURIComponent(applicationId)}&access=${encodeURIComponent(accessToken)}&payment=cancelled`,
        },
      }
    );

    if (!invoice.invoice_url || !invoice.id) {
      return res.status(502).json({
        message:
          'NOWPayments did not return a valid invoice URL.',
      });
    }

    await pool.execute(
      `INSERT INTO payment_orders (
        application_id,
        pending_session_id,
        order_id,
        invoice_id,
        payment_id,
        payment_status,
        price_amount,
        price_currency,
        pay_currency,
        invoice_url,
        provider_payload,
        created_at,
        updated_at
      )
      VALUES (
        NULL, ?, ?, ?, NULL,
        'WAITING', ?, 'USD', NULL, ?, ?, NOW(), NOW()
      )`,
      [
        applicationId,
        orderId,
        String(invoice.id),
        Number(APPLICATION_FEE_USD.toFixed(2)),
        invoice.invoice_url,
        JSON.stringify(invoice),
      ]
    );

    res.status(201).json({
      invoiceUrl: invoice.invoice_url,
      invoiceId: String(invoice.id),
      orderId,
      paymentStatus: 'WAITING',
    });
  })
);

/* ============================================================
   NOWPAYMENTS IPN WEBHOOK
   ============================================================ */

/*
 * The browser return URL does not confirm payment.
 * Payment is finalized only after the signed IPN notification
 * and a server-to-server verification with NOWPayments.
 */

app.post(
  '/api/payments/nowpayments/ipn',
  asyncRoute(async (req, res) => {
    const signature = req.headers['x-nowpayments-sig'];

    if (
      !verifyNowPaymentsSignature(req.body, signature)
    ) {
      return res.status(401).json({
        message: 'Invalid NOWPayments IPN signature.',
      });
    }

    const body = req.body || {};

    const orderId = clean(body.order_id, 100);

    const paymentId =
      body.payment_id == null
        ? ''
        : String(body.payment_id);

    const status = clean(
      body.payment_status,
      40
    ).toLowerCase();

    if (!orderId) {
      return res.status(400).json({
        message: 'Missing order_id.',
      });
    }

    const [orders] = await pool.execute(
      `SELECT *
       FROM payment_orders
       WHERE order_id = ?
       LIMIT 1`,
      [orderId]
    );

    const order = orders[0];

    if (!order) {
      return res.status(404).json({
        message: 'Payment order not found.',
      });
    }

    /*
     * Record non-final payment states without granting access.
     */

    if (status !== 'finished') {
      const mapped =
        status === 'failed'
          ? 'FAILED'
          : status === 'expired'
            ? 'EXPIRED'
            : status === 'refunded'
              ? 'REFUNDED'
              : status === 'partially_paid'
                ? 'PARTIALLY_PAID'
                : status.toUpperCase() || 'PENDING';

      await pool.execute(
        `UPDATE payment_orders
         SET payment_status = ?,
             payment_id = ?,
             provider_payload = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          mapped,
          paymentId || null,
          JSON.stringify(body),
          order.id,
        ]
      );

      if (
        order.pending_session_id &&
        ['FAILED', 'EXPIRED', 'REFUNDED'].includes(mapped)
      ) {
        await pool.execute(
          `UPDATE pending_application_sessions
           SET session_status = ?
           WHERE id = ?
             AND session_status <> 'PAID'`,
          [mapped, order.pending_session_id]
        );
      }

      return res.json({
        received: true,
        paymentStatus: mapped,
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        message:
          'Missing payment_id for finished payment.',
      });
    }

    /*
     * Verify the payment directly with NOWPayments.
     */

    const providerPayment = await nowPaymentsRequest(
      `/payment/${encodeURIComponent(paymentId)}`
    );

    const verifiedStatus = String(
      providerPayment.payment_status || ''
    ).toLowerCase();

    const verifiedOrderId = String(
      providerPayment.order_id || ''
    );

    const verifiedCurrency = String(
      providerPayment.price_currency || ''
    ).toUpperCase();

    const verifiedAmount = providerPayment.price_amount;

    if (
      verifiedStatus !== 'finished' ||
      verifiedOrderId !== order.order_id ||
      verifiedCurrency !==
        String(order.price_currency || 'USD').toUpperCase() ||
      !moneyEqual(verifiedAmount, order.price_amount)
    ) {
      return res.status(400).json({
        message:
          'Payment verification did not match the expected order, amount, currency, or status.',
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [lockedRows] = await connection.execute(
        `SELECT *
         FROM payment_orders
         WHERE id = ?
         FOR UPDATE`,
        [order.id]
      );

      const lockedOrder = lockedRows[0];

      if (!lockedOrder) {
        await connection.rollback();

        return res.status(404).json({
          message: 'Payment order no longer exists.',
        });
      }

      /*
       * If already linked to a final application, update its
       * verified payment details without creating a duplicate.
       */

      if (lockedOrder.application_id) {
        await connection.execute(
          `UPDATE payment_orders
           SET payment_status = 'FINISHED',
               payment_id = ?,
               pay_currency = ?,
               provider_payload = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            paymentId,
            providerPayment.pay_currency || null,
            JSON.stringify(providerPayment),
            lockedOrder.id,
          ]
        );

        await connection.execute(
          `UPDATE applications
           SET payment_status = 'PAYMENT VERIFIED',
               application_status = 'UNDER REVIEW'
           WHERE application_id = ?`,
          [lockedOrder.application_id]
        );
      } else {
        const [pendingRows] = await connection.execute(
          `SELECT *
           FROM pending_application_sessions
           WHERE id = ?
           FOR UPDATE`,
          [lockedOrder.pending_session_id]
        );

        const pending = pendingRows[0];

        if (!pending) {
          await connection.rollback();

          return res.status(404).json({
            message:
              'Pending application session not found.',
          });
        }

        await createFinalApplicationFromPaidSession(
          connection,
          pending,
          lockedOrder,
          providerPayment
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({
      received: true,
      paymentStatus: 'FINISHED',
    });
  })
);

/* ============================================================
   PRIVATE APPLICANT DOCUMENT UPLOAD
   ============================================================ */

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await fs.mkdir(uploadDirectory, {
        recursive: true,
      });

      callback(null, uploadDirectory);
    } catch (error) {
      callback(error);
    }
  },

  filename: (_req, file, callback) => {
    const ext = path.extname(
      file.originalname || ''
    ).toLowerCase();

    callback(
      null,
      `${crypto.randomBytes(20).toString('hex')}${ext}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const allowed = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
    ]);

    if (!allowed.has(file.mimetype)) {
      return callback(
        new Error(
          'Only PDF, JPG, and PNG files are allowed.'
        )
      );
    }

    callback(null, true);
  },
});

app.post(
  '/api/applications/:applicationId/documents',
  upload.single('document'),
  asyncRoute(async (req, res) => {
    const token = getBearerToken(req);

    const auth = await getPendingOrFinalApplication(
      req.params.applicationId,
      token
    );

    if (
      !auth ||
      auth.kind !== 'final' ||
      String(auth.row.payment_status).toUpperCase() !==
        'PAYMENT VERIFIED'
    ) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      return res.status(403).json({
        message:
          'Verified payment is required before uploading documents.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Choose a document to upload.',
      });
    }

    const documentType = clean(
      req.body.documentType ||
        req.body.document_type ||
        'supporting_document',
      100
    );

    const [result] = await pool.execute(
      `INSERT INTO applicant_documents (
        application_id,
        document_type,
        original_name,
        stored_name,
        mime_type,
        file_size,
        file_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.applicationId,
        documentType,
        path.basename(req.file.originalname).slice(0, 255),
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.file.path,
      ]
    );

    res.status(201).json({
      ok: true,
      documentId: result.insertId,
      message: 'Document uploaded successfully.',
    });
  })
);

/* ============================================================
   ADMIN AUTHENTICATION
   ============================================================ */

/*
 * Supported password formats:
 * - scrypt with a 64-byte hash and stored salt
 * - SHA-512 of salt + password
 * - SHA-512 of password + salt
 *
 * Your admin creation script must use one of these formats.
 */

function verifyAdminPassword(
  password,
  salt,
  storedHash
) {
  const hash = String(storedHash || '').toLowerCase();
  const saltText = String(salt || '');

  if (!hash || !saltText) {
    return false;
  }

  const candidates = [];

  try {
    candidates.push(
      crypto.scryptSync(
        password,
        saltText,
        64
      ).toString('hex')
    );
  } catch {
    // Continue checking other supported formats.
  }

  candidates.push(
    crypto.createHash('sha512')
      .update(`${saltText}${password}`)
      .digest('hex')
  );

  candidates.push(
    crypto.createHash('sha512')
      .update(`${password}${saltText}`)
      .digest('hex')
  );

  return candidates.some(
    (candidate) =>
      candidate.length === hash.length &&
      timingSafeEqualHex(candidate, hash)
  );
}

function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_HOURS * 60 * 60 * 1000,
  };
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return '';
}

async function requireAdmin(req, res, next) {
  try {
    const token =
      readCookie(req, 'crown_admin_session') ||
      getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        message: 'Admin authentication required.',
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         s.id AS session_id,
         s.expires_at,
         a.id AS admin_id,
         a.email
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_id
       WHERE s.token_hash = ?
         AND s.expires_at > NOW()
         AND a.is_active = 1
       LIMIT 1`,
      [sha256(token)]
    );

    if (!rows[0]) {
      return res.status(401).json({
        message:
          'Admin session is invalid or expired.',
      });
    }

    req.admin = rows[0];
    req.adminToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

/* Admin login */

app.post(
  '/api/admin/login',
  asyncRoute(async (req, res) => {
    const email = clean(
      req.body?.email,
      255
    ).toLowerCase();

    const password = String(
      req.body?.password || ''
    );

    if (!validEmail(email) || !password) {
      return res.status(400).json({
        message: 'Enter a valid admin email and password.',
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         id,
         email,
         password_hash,
         password_salt,
         is_active
       FROM admin_users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const admin = rows[0];

    if (
      !admin ||
      !admin.is_active ||
      !verifyAdminPassword(
        password,
        admin.password_salt,
        admin.password_hash
      )
    ) {
      return res.status(401).json({
        message: 'Invalid admin email or password.',
      });
    }

    const token = makeAccessToken();

    const expiresAt = new Date(
      Date.now() +
        ADMIN_SESSION_HOURS * 60 * 60 * 1000
    );

    await pool.execute(
      `INSERT INTO admin_sessions
        (admin_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [
        admin.id,
        sha256(token),
        expiresAt,
      ]
    );

    res.cookie(
      'crown_admin_session',
      token,
      adminCookieOptions()
    );

    res.json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
      },
      accessToken: token,
      expiresAt,
    });
  })
);

/* Check current admin session */

app.get(
  '/api/admin/me',
  requireAdmin,
  (req, res) => {
    res.json({
      ok: true,
      admin: {
        id: req.admin.admin_id,
        email: req.admin.email,
      },
    });
  }
);

/* Admin logout */

app.post(
  '/api/admin/logout',
  asyncRoute(async (req, res) => {
    const token =
      readCookie(req, 'crown_admin_session') ||
      getBearerToken(req);

    if (token) {
      await pool.execute(
        'DELETE FROM admin_sessions WHERE token_hash = ?',
        [sha256(token)]
      );
    }

    res.clearCookie(
      'crown_admin_session',
      {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: IS_PRODUCTION ? 'none' : 'lax',
        path: '/',
      }
    );

    res.json({ ok: true });
  })
);

/* ============================================================
   ADMIN APPLICATION LIST
   ============================================================ */

/*
 * Only applications with verified payments appear here.
 */

app.get(
  '/api/admin/applications',
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         a.*,

         (
           SELECT po.payment_status
           FROM payment_orders po
           WHERE
             po.application_id = a.application_id
             OR po.pending_session_id = a.application_id
           ORDER BY po.created_at DESC
           LIMIT 1
         ) AS latest_payment_status,

         (
           SELECT po.invoice_id
           FROM payment_orders po
           WHERE
             po.application_id = a.application_id
             OR po.pending_session_id = a.application_id
           ORDER BY po.created_at DESC
           LIMIT 1
         ) AS invoice_id,

         (
           SELECT po.payment_id
           FROM payment_orders po
           WHERE
             po.application_id = a.application_id
             OR po.pending_session_id = a.application_id
           ORDER BY po.created_at DESC
           LIMIT 1
         ) AS payment_id

       FROM applications a

       WHERE UPPER(a.payment_status) = 'PAYMENT VERIFIED'

       ORDER BY a.created_at DESC`
    );

    res.json({
      applications: rows.map((row) => ({
        ...publicApplication(row),
        latestPaymentStatus: row.latest_payment_status,
        invoiceId: row.invoice_id,
        paymentId: row.payment_id,
      })),
    });
  })
);

/* ============================================================
   ADMIN APPLICATION DETAILS
   ============================================================ */

app.get(
  '/api/admin/applications/:applicationId',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT *
       FROM applications
       WHERE application_id = ?
         AND UPPER(payment_status) = 'PAYMENT VERIFIED'
       LIMIT 1`,
      [req.params.applicationId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        message: 'Paid application not found.',
      });
    }

    const [documents] = await pool.execute(
      `SELECT
         id,
         document_type AS documentType,
         original_name AS originalName,
         mime_type AS mimeType,
         file_size AS fileSize,
         uploaded_at AS uploadedAt
       FROM applicant_documents
       WHERE application_id = ?
       ORDER BY uploaded_at DESC`,
      [req.params.applicationId]
    );

    const [payments] = await pool.execute(
      `SELECT
         order_id,
         invoice_id,
         payment_id,
         payment_status,
         price_amount,
         price_currency,
         pay_currency,
         created_at
       FROM payment_orders
       WHERE
         application_id = ?
         OR pending_session_id = ?
       ORDER BY created_at DESC`,
      [
        req.params.applicationId,
        req.params.applicationId,
      ]
    );

    res.json({
      application: publicApplication(rows[0]),
      documents,
      payments,
    });
  })
);

/* ============================================================
   ADMIN DOCUMENT DOWNLOAD
   ============================================================ */

app.get(
  '/api/admin/applications/:applicationId/documents/:documentId',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT *
       FROM applicant_documents
       WHERE id = ?
         AND application_id = ?
       LIMIT 1`,
      [
        req.params.documentId,
        req.params.applicationId,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({
        message: 'Document not found.',
      });
    }

    const filePath = rows[0].file_path;

    await fs.access(filePath);

    res.download(
      filePath,
      rows[0].original_name
    );
  })
);

/* ============================================================
   CENTRAL ERROR HANDLER
   ============================================================ */

app.use((error, _req, res, _next) => {
  console.error(
    '[acquisition-api]',
    error?.stack || error
  );

  if (res.headersSent) {
    return;
  }

  const status =
    Number(error?.status) ||
    (
      error instanceof multer.MulterError
        ? 400
        : 500
    );

  res.status(status).json({
    message:
      status === 500
        ? 'An unexpected server error occurred.'
        : error.message,
  });
});

/* ============================================================
   START SERVER AFTER DATABASE INITIALIZATION
   ============================================================ */

ensureSchema()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `Acquisition API listening on port ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      'Failed to initialize acquisition database schema:',
      error
    );

    process.exit(1);
  });
