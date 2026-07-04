// Shared auth helper — not a Vercel route (prefixed with _)
import { createHmac } from 'crypto';

function decodeToken(token, secret) {
  try {
    const [payload, sig] = token.split('.');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(Buffer.from(b64, 'base64').toString());
    if (data.expiry < Date.now()) return null;
    return data; // { email, expiry, jti }
  } catch (e) { return null; }
}

// Checks signature + expiry + Supabase revocation in one call.
// Returns the token payload { email, expiry, jti } or null if invalid/revoked.
export async function verifyToken(token) {
  const secret = (process.env.AUTH_SECRET || '').trim();
  const data = decodeToken(token, secret);
  if (!data) return null;

  // Tokens issued before the jti field was added have no revocation record —
  // accept them as-is (they'll expire naturally within their original TTL).
  if (!data.jti) return data;

  const base = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!base || !key) return data; // fall back to signature-only if DB not configured

  try {
    const r = await fetch(
      `${base}/rest/v1/auth_sessions?jti=eq.${encodeURIComponent(data.jti)}&select=revoked`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return null; // not in DB = invalid
    if (rows[0].revoked) return null;
    return data;
  } catch (e) {
    // DB unreachable — fall back to signature-only so auth never hard-fails due to DB
    console.error('[auth] session DB check failed, falling back to signature-only:', e.message);
    return data;
  }
}

export async function getAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  return verifyToken(token);
}

export function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

export const SUPABASE_URL = () => (process.env.SUPABASE_URL || '').trim();
