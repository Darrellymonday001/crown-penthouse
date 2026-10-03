import crypto from 'crypto';
import pool from './database.js';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.');
const salt = crypto.randomBytes(32).toString('hex');
const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
await pool.query('INSERT INTO admin_users (email, password_hash, password_salt) VALUES (?, ?, ?)', [email, passwordHash, salt]);
await pool.end();
console.log(`Admin created: ${email}`);