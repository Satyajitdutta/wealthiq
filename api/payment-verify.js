// Verify Cashfree payment and upgrade plan in Supabase
import { getAuth, sbHeaders, SUPABASE_URL } from './_auth.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const user = getAuth(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let body;
  try { body = await readBody(req); } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const { orderId, plan } = body;
  if (!orderId || !plan) { res.status(400).json({ error: 'orderId and plan required' }); return; }

  const appId     = (process.env.CASHFREE_APP_ID     || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const cfEnv     = (process.env.CASHFREE_ENV        || 'production').trim();
  if (!appId || !secretKey) { res.status(500).json({ error: 'Cashfree not configured' }); return; }

  const baseUrl = cfEnv === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

  try {
    // Fetch order status from Cashfree
    const r = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     appId,
        'x-client-secret': secretKey
      }
    });
    const order = await r.json();
    if (!r.ok) throw new Error(order.message || 'Could not fetch order');

    if (order.order_status !== 'PAID') {
      res.status(400).json({ error: `Payment not confirmed (status: ${order.order_status})` }); return;
    }

    // Upgrade plan in Supabase
    const base      = SUPABASE_URL();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(user.email)}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ plan, plan_expires_at: expiresAt })
    });

    res.status(200).json({ success: true, plan, expiresAt });
  } catch(e) {
    console.error('Cashfree verify error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
