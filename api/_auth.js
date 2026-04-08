// Shared auth helper — not a Vercel route (prefixed with _)
import { createHmac } from 'crypto';

export function verifyToken(token) {
  const secret = (process.env.AUTH_SECRET || '').trim();
  try {
    const [payload, sig] = token.split('.');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const b64 = payload.replace(/-/g,'+').replace(/_/g,'/');
    const data = JSON.parse(Buffer.from(b64, 'base64').toString());
    if (data.expiry < Date.now()) return null;
    return data; // { email, expiry }
  } catch(e) { return null; }
}

export function getAuth(req) {
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
