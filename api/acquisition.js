import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const cookieName = 'crown_admin_session';
const sessionTtlMs = 8 * 60 * 60 * 1000;
const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../database/acquisition-schema.sql');
const documentDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../private-uploads');
const upload = multer({ dest: documentDirectory, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) });

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

function token(bytes = 32) { return crypto.randomBytes(bytes).toString('hex'); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function parseCookies(request) { return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]; })); }
function setSessionCookie(response, value) { response.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(value)}; Max-Age=${sessionTtlMs / 1000}; Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`); }
function clearSessionCookie(response) { response.setHeader('Set-Cookie', `${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`); }
function passwordHash(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(left, right) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function publicApplication(row) { return { applicationId: row.application_id, name: row.name, email: row.email, phone: row.phone, residence: row.residence, budgetRange: row.budget_range, purchaseIntent: row.purchase_intent, paymentPreference: row.payment_preference, applicationStatus: row.application_status, paymentStatus: row.payment_status, salesRepresentative: row.sales_representative, createdAt: row.created_at }; }
function isPublicHttpsUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname); } catch { return false; } }
function canonicalNowPaymentPayload(value) { if (Array.isArray(value)) return value.map(canonicalNowPaymentPayload); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((sorted, key) => { sorted[key] = canonicalNowPaymentPayload(value[key]); return sorted; }, {}); return value; }
function verifyNowPaymentSignature(payload, signature) { const secret = process.env.NOWPAYMENTS_IPN_SECRET || ''; if (!secret || !signature) return false; const expected = crypto.createHmac('sha512', secret).update(JSON.stringify(canonicalNowPaymentPayload(payload))).digest('hex'); return safeEqual(expected.toLowerCase(), String(signature).toLowerCase()); }
async function nowPaymentsRequest(endpoint, options = {}) { const apiKey = process.env.NOWPAYMENTS_API_KEY; if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY is not configured on the server.'); const response = await fetch(`https://api.nowpayments.io/v1${endpoint}`, { ...options, headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', ...(options.headers || {}) } }); const result = await response.json(); if (!response.ok) throw new Error(result.message || result.msg || `NOWPayments API returned HTTP ${response.status}.`); return result; }
function applicantAuth(request, response, next) { const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '') || request.body?.accessToken; if (!suppliedToken) return response.status(401).json({ message: 'Application access token required.' }); request.applicantAccessToken = suppliedToken; request.applicantTokenHash = hash(suppliedToken); return next(); }
async function ensureSchema() {
  await fs.mkdir(documentDirectory, { recursive: true });
  const schema = await fs.readFile(schemaPath, 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) await pool.query(statement);
  const [columns] = await pool.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'applications\'');
  const existing = new Set(columns.map((column) => column.COLUMN_NAME));
  const additions = {
    access_token_hash: 'CHAR(64) NULL UNIQUE',
    residence: 'VARCHAR(255) NOT NULL DEFAULT \'\'',
    budget_range: 'VARCHAR(255) NOT NULL DEFAULT \'\'',
    purchase_intent: 'VARCHAR(100) NOT NULL DEFAULT \'Requesting More Information\'',
    payment_preference: 'VARCHAR(40) NOT NULL DEFAULT \'USDT\'',
    application_status: 'VARCHAR(40) NOT NULL DEFAULT \'NEW\'',
    payment_status: 'VARCHAR(50) NOT NULL DEFAULT \'NOT REQUESTED\'',
    sales_representative: 'VARCHAR(255) NOT NULL DEFAULT \'Unassigned\'',
  };
  for (const [column, definition] of Object.entries(additions)) if (!existing.has(column)) await pool.query(`ALTER TABLE applications ADD COLUMN ${column} ${definition}`);
}

async function requireAdmin(request, response, next) {
  try {
    const sessionId = parseCookies(request)[cookieName];
    if (!sessionId) return response.status(401).json({ message: 'Admin authentication required.' });
    const [rows] = await pool.query('SELECT admin_id FROM admin_sessions WHERE session_token_hash = ? AND expires_at > UTC_TIMESTAMP()', [hash(sessionId)]);
    if (!rows.length) return response.status(401).json({ message: 'Admin session expired.' });
    request.adminId = rows[0].admin_id;
    return next();
  } catch (error) { return response.status(500).json({ message: 'Unable to validate admin session.' }); }
}

app.get('/api/health', (_request, response) => response.json({ ok: true }));

app.post('/api/admin/login', async (request, response) => {
  const { email, password } = request.body || {};
  if (!email || !password) return response.status(400).json({ message: 'Email and password are required.' });
  const [rows] = await pool.query('SELECT id, password_hash, password_salt, is_active FROM admin_users WHERE email = ? LIMIT 1', [String(email).trim().toLowerCase()]);
  const admin = rows[0];
  if (!admin || !admin.is_active || !safeEqual(passwordHash(String(password), admin.password_salt), admin.password_hash)) return response.status(401).json({ message: 'Invalid admin credentials.' });
  const session = token();
  await pool.query('INSERT INTO admin_sessions (admin_id, session_token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))', [admin.id, hash(session)]);
  setSessionCookie(response, session);
  return response.json({ authenticated: true });
});

app.post('/api/admin/logout', requireAdmin, async (request, response) => { await pool.query('DELETE FROM admin_sessions WHERE admin_id = ?', [request.adminId]); clearSessionCookie(response); return response.json({ authenticated: false }); });
app.get('/api/admin/me', requireAdmin, (_request, response) => response.json({ authenticated: true }));

app.post('/api/applications', async (request, response) => {
  const { name, email, phone, residence, budgetRange, purchaseIntent, paymentPreference, conversationHistory = [] } = request.body || {};
  if (!name || !email || !phone || !residence || !purchaseIntent || !paymentPreference) return response.status(400).json({ message: 'Complete applicant information is required.' });
  const applicationId = `CPC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const accessToken = token(24);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO applications (application_id, access_token_hash, name, email, phone, residence, budget_range, purchase_intent, payment_preference, application_status, payment_status, sales_representative) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'NEW\', \'NOT REQUESTED\', \'Unassigned\')', [applicationId, hash(accessToken), name.trim(), email.trim().toLowerCase(), phone.trim(), residence, budgetRange || '', purchaseIntent, paymentPreference]);
    for (const entry of Array.isArray(conversationHistory) ? conversationHistory : []) await connection.query('INSERT INTO conversation_messages (application_id, sender, message, created_at) VALUES (?, ?, ?, ?)', [applicationId, entry.sender || 'system', String(entry.message || ''), entry.createdAt ? new Date(entry.createdAt) : new Date()]);
    await connection.commit();
    return response.status(201).json({ applicationId, accessToken });
  } catch (error) { await connection.rollback(); console.error('[APPLICATION_CREATE]', error); return response.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Application could not be created.' : `Application could not be created: ${error.message}` }); } finally { connection.release(); }
});

app.get('/api/applications/:applicationId', async (request, response) => {
  const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!suppliedToken) return response.status(401).json({ message: 'Application access token required.' });
  const [rows] = await pool.query('SELECT * FROM applications WHERE application_id = ? AND access_token_hash = ?', [request.params.applicationId, hash(suppliedToken)]);
  if (!rows.length) return response.status(404).json({ message: 'Application not found.' });
  const [messages] = await pool.query('SELECT sender, message, created_at AS createdAt FROM conversation_messages WHERE application_id = ? ORDER BY created_at ASC', [request.params.applicationId]);
  const [orders] = await pool.query('SELECT order_id AS orderId, payment_status AS paymentStatus, price_amount AS priceAmount, price_currency AS priceCurrency, pay_currency AS payCurrency, invoice_url AS invoiceUrl FROM payment_orders WHERE application_id = ? ORDER BY id DESC LIMIT 1', [request.params.applicationId]);
  const application = publicApplication(rows[0]);
  return response.json({ application: { ...application, portalAccess: application.paymentStatus === 'PAYMENT VERIFIED', paymentOrder: orders[0] || null }, conversationHistory: messages });
});

app.post('/api/applications/:applicationId/payment', applicantAuth, async (request, response) => {
  const selectedCurrency = String(request.body?.payCurrency || '').toLowerCase();
  const allowedCurrencies = new Set(['btc', 'eth', 'sol', 'usdttrc20']);
  if (!allowedCurrencies.has(selectedCurrency)) return response.status(400).json({ message: 'Select a supported payment currency.' });
  const [applications] = await pool.query('SELECT application_id, email, name, residence FROM applications WHERE application_id = ? AND access_token_hash = ?', [request.params.applicationId, request.applicantTokenHash]);
  if (!applications.length) return response.status(404).json({ message: 'Application not found.' });
  const application = applications[0];
  const [existingOrders] = await pool.query('SELECT order_id AS orderId, invoice_url AS invoiceUrl FROM payment_orders WHERE application_id = ? AND pay_currency = ? AND payment_status NOT IN (\'finished\', \'failed\', \'expired\') ORDER BY id DESC LIMIT 1', [application.application_id, selectedCurrency]);
  if (existingOrders.length && existingOrders[0].invoiceUrl) return response.json({ invoiceUrl: existingOrders[0].invoiceUrl, orderId: existingOrders[0].orderId, reused: true });
  const orderId = `CPC-${application.application_id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const feeAmount = Number(process.env.APPLICATION_FEE_USD || 80);
  const origin = process.env.PUBLIC_APP_URL;
  const callbackBase = process.env.API_PUBLIC_URL;
  if (!isPublicHttpsUrl(origin) || !isPublicHttpsUrl(callbackBase)) return response.status(503).json({ message: 'Set PUBLIC_APP_URL and API_PUBLIC_URL to publicly reachable HTTPS addresses before starting NOWPayments checkout.' });
  try {
    const access = encodeURIComponent(request.applicantAccessToken);
    const returnUrl = `${origin}/tenant-portal.html?application=${encodeURIComponent(application.application_id)}&access=${access}`;
    const invoice = await nowPaymentsRequest('/invoice', { method: 'POST', body: JSON.stringify({ price_amount: feeAmount, price_currency: 'usd', pay_currency: selectedCurrency, order_id: orderId, order_description: `Crown Penthouse Collection application fee - ${application.application_id}`, ipn_callback_url: `${callbackBase.replace(/\/$/, '')}/api/payments/nowpayments/ipn`, success_url: `${returnUrl}&payment=success`, cancel_url: `${returnUrl}&payment=cancelled` }) });
    await pool.query('INSERT INTO payment_orders (application_id, order_id, invoice_id, payment_status, price_amount, price_currency, pay_currency, invoice_url, provider_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [application.application_id, orderId, invoice.id || null, 'waiting', feeAmount, 'USD', selectedCurrency, invoice.invoice_url, JSON.stringify(invoice)]);
    await pool.query('UPDATE applications SET application_status = \'PAYMENT PENDING\', payment_status = \'PAYMENT PENDING\' WHERE application_id = ?', [application.application_id]);
    return response.status(201).json({ invoiceUrl: invoice.invoice_url, orderId, invoiceId: invoice.id });
  } catch (error) { console.error('[NOWPAYMENTS_INVOICE]', error); return response.status(502).json({ message: error.message || 'Unable to start crypto checkout.' }); }
});

app.post('/api/payments/nowpayments/ipn', async (request, response) => {
  const payload = request.body || {};
  if (!verifyNowPaymentSignature(payload, request.headers['x-nowpayments-sig'])) return response.status(401).send('Invalid signature');
  const orderId = String(payload.order_id || '');
  if (!orderId) return response.status(400).send('Missing order id');
  const [orders] = await pool.query('SELECT * FROM payment_orders WHERE order_id = ? LIMIT 1', [orderId]);
  if (!orders.length) return response.status(404).send('Unknown order');
  const status = String(payload.payment_status || '').toLowerCase();
  const [applications] = await pool.query('SELECT application_id FROM applications WHERE application_id = ?', [orders[0].application_id]);
  if (!applications.length) return response.status(404).send('Unknown application');
  if (status === 'finished') {
    if (!payload.payment_id) return response.status(400).send('Missing payment id');
    const providerPayment = await nowPaymentsRequest(`/payment/${encodeURIComponent(payload.payment_id)}`, { method: 'GET' });
    const matches = String(providerPayment.order_id) === orderId && String(providerPayment.payment_status).toLowerCase() === 'finished' && String(providerPayment.pay_currency).toLowerCase() === orders[0].pay_currency && String(providerPayment.price_currency).toLowerCase() === 'usd' && Math.abs(Number(providerPayment.price_amount) - Number(orders[0].price_amount)) < 0.01;
    if (!matches) return response.status(422).send('Provider payment does not match the order');
    await pool.query('UPDATE payment_orders SET payment_id = ?, payment_status = \'finished\', provider_payload = ? WHERE id = ?', [String(providerPayment.payment_id), JSON.stringify(providerPayment), orders[0].id]);
    await pool.query('UPDATE applications SET application_status = \'PAYMENT VERIFIED\', payment_status = \'PAYMENT VERIFIED\' WHERE application_id = ?', [orders[0].application_id]);
    return response.status(200).send('OK');
  }
  await pool.query('UPDATE payment_orders SET payment_id = ?, payment_status = ?, provider_payload = ? WHERE id = ?', [payload.payment_id ? String(payload.payment_id) : null, status || 'unknown', JSON.stringify(payload), orders[0].id]);
  return response.status(200).send('OK');
});

app.post('/api/applications/:applicationId/documents', applicantAuth, upload.single('document'), async (request, response) => {
  if (!request.file) return response.status(400).json({ message: 'Upload a PDF, JPG, or PNG document under 5 MB.' });
  const [applications] = await pool.query('SELECT application_id FROM applications WHERE application_id = ? AND access_token_hash = ? AND payment_status = \'PAYMENT VERIFIED\'', [request.params.applicationId, request.applicantTokenHash]);
  if (!applications.length) { await fs.unlink(request.file.path).catch(() => {}); return response.status(403).json({ message: 'Verified payment is required before document upload.' }); }
  const documentType = String(request.body.documentType || 'supporting-document').slice(0, 40);
  await pool.query('INSERT INTO applicant_documents (application_id, document_type, original_name, stored_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)', [request.params.applicationId, documentType, path.basename(request.file.originalname), request.file.filename, request.file.mimetype, request.file.size]);
  return response.status(201).json({ status: true, filename: path.basename(request.file.originalname) });
});

app.get('/api/admin/documents/:documentId', requireAdmin, async (request, response) => {
  const [rows] = await pool.query('SELECT stored_name, original_name, mime_type FROM applicant_documents WHERE id = ?', [request.params.documentId]);
  if (!rows.length) return response.status(404).json({ message: 'Document not found.' });
  response.type(rows[0].mime_type).attachment(rows[0].original_name);
  return fs.readFile(path.join(documentDirectory, rows[0].stored_name)).then((content) => response.send(content));
});

app.get('/api/admin/applications', requireAdmin, async (_request, response) => {
  const [rows] = await pool.query('SELECT a.*, po.payment_status AS provider_payment_status, po.price_amount AS provider_price_amount, po.price_currency, po.pay_currency, po.order_id AS provider_order_id, po.payment_id AS provider_payment_id FROM applications a LEFT JOIN payment_orders po ON po.application_id = a.application_id AND po.id = (SELECT MAX(id) FROM payment_orders WHERE application_id = a.application_id) ORDER BY a.created_at DESC');
  return response.json({ applications: rows.map((row) => ({ ...publicApplication(row), paymentOrder: row.provider_order_id ? { orderId: row.provider_order_id, paymentId: row.provider_payment_id, paymentStatus: row.provider_payment_status, priceAmount: row.provider_price_amount, priceCurrency: row.price_currency, payCurrency: row.pay_currency } : null })) });
});
app.get('/api/admin/applications/:applicationId/conversation', requireAdmin, async (request, response) => { const [rows] = await pool.query('SELECT sender, message, created_at AS createdAt FROM conversation_messages WHERE application_id = ? ORDER BY created_at ASC', [request.params.applicationId]); return response.json({ conversationHistory: rows }); });
app.get('/api/admin/applications/:applicationId/documents', requireAdmin, async (request, response) => {
  const [rows] = await pool.query('SELECT id, document_type AS documentType, original_name AS originalName, mime_type AS mimeType, file_size AS fileSize, uploaded_at AS uploadedAt FROM applicant_documents WHERE application_id = ? ORDER BY uploaded_at DESC', [request.params.applicationId]);
  return response.json({ documents: rows });
});

if (process.env.NODE_ENV !== 'test') ensureSchema().then(() => app.listen(PORT, () => console.log(`Acquisition API listening on http://localhost:${PORT}`))).catch((error) => { console.error('[DATABASE_INIT]', error); process.exitCode = 1; });
export default app;