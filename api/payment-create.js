// Create Cashfree order and return payment session ID
import { getAuth } from './_auth.js';

const PLANS = {
  basic:        { amount: 49,   label: 'Basic' },
  essential:    { amount: 299,  label: 'Essential' },
  intelligence: { amount: 699,  label: 'Intelligence' },
  family:       { amount: 999,  label: 'Family' }
};

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

  const plan = body.plan;
  if (!PLANS[plan]) { res.status(400).json({ error: 'Invalid plan' }); return; }

  const appId     = (process.env.CASHFREE_APP_ID     || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const cfEnv     = (process.env.CASHFREE_ENV        || 'production').trim(); // 'sandbox' or 'production'
  if (!appId || !secretKey) { res.status(500).json({ error: 'Cashfree not configured' }); return; }

  const baseUrl = cfEnv === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

  const planInfo = PLANS[plan];
  const orderId  = `wiq_${plan}_${Date.now()}`;

  try {
    const r = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-api-version':    '2023-08-01',
        'x-client-id':      appId,
        'x-client-secret':  secretKey,
        'Content-Type':     'application/json'
      },
      body: JSON.stringify({
        order_id:       orderId,
        order_amount:   planInfo.amount,
        order_currency: 'INR',
        customer_details: {
          customer_id:    user.email.replace(/[^a-z0-9]/gi, '_').slice(0, 50),
          customer_email: user.email,
          customer_phone: '9999999999'   // placeholder — not collected in app
        },
        order_meta: {
          notify_url: `https://pithonix-wealthiq.vercel.app/api/payment-verify`
        },
        order_note: `WealthIQ ${planInfo.label} plan`
      })
    });

    const order = await r.json();
    if (!r.ok) throw new Error(order.message || 'Order creation failed');

    res.status(200).json({
      success:          true,
      orderId:          order.order_id,
      paymentSessionId: order.payment_session_id,
      amount:           planInfo.amount,
      planLabel:        planInfo.label,
      email:            user.email,
      env:              cfEnv
    });
  } catch(e) {
    console.error('Cashfree order error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
