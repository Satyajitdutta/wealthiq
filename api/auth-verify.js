// WealthIQ — Verify OTP and return session token
import { createHmac } from 'crypto';

function getOTP(secret, email, bucket) {
  const h = createHmac('sha256', secret).update(`${email}:${bucket}`).digest('hex');
  return String(parseInt(h.slice(-8), 16) % 1000000).padStart(6, '0');
}

function makeToken(secret, email) {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = Buffer.from(JSON.stringify({ email, expiry })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try { body = await readBody(req); } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const email = (body.email || '').trim().toLowerCase();
  const otp = (body.otp || '').trim().replace(/\s/g, '');

  if (!email || !otp) { res.status(400).json({ error: 'Email and code required' }); return; }

  const secret = (process.env.AUTH_SECRET || '').trim();
  if (!secret) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  // Demo account — fixed OTP 000000
  const isDemo = email === 'user@test.com';
  if (isDemo && otp !== '000000') { res.status(401).json({ error: 'Demo code is 000000' }); return; }

  if (!isDemo) {
    const bucket = Math.floor(Date.now() / 300000);
    const valid = otp === getOTP(secret, email, bucket) ||
                  otp === getOTP(secret, email, bucket - 1);
    if (!valid) { res.status(401).json({ error: 'Invalid or expired code. Try again.' }); return; }
  }

  const token = makeToken(secret, email);
  res.status(200).json({ success: true, token, email });
}
