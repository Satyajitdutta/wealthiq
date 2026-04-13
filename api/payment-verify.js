// Verify Cashfree payment and update plan or module credits in Supabase
import { getAuth, sbHeaders, SUPABASE_URL } from './_auth.js';

const SUBSCRIPTION_PLAN = 'full_view';

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
    // Verify with Cashfree
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

    const base = SUPABASE_URL();
    const userUrl = `${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(user.email)}`;

    if (plan === SUBSCRIPTION_PLAN) {
      // Full View subscription — set plan + 30-day expiry
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await fetch(userUrl, {
        method: 'PATCH',
        headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ plan: 'full_view', plan_expires_at: expiresAt })
      });

      // Referral activation: find pending referral for this user, activate it, award ₹50 to referrer
      try {
        const refRes = await fetch(
          `${base}/rest/v1/wealthiq_referrals?referee_email=eq.${encodeURIComponent(user.email)}&status=eq.pending&select=id,referral_code,referrer_email`,
          { headers: sbHeaders() }
        );
        const refRows = await refRes.json();
        if (Array.isArray(refRows) && refRows.length > 0) {
          const ref = refRows[0];
          const clawbackDeadline = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(); // 6 months
          // Activate the referral row
          await fetch(
            `${base}/rest/v1/wealthiq_referrals?id=eq.${ref.id}`,
            {
              method: 'PATCH',
              headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
              body: JSON.stringify({ status: 'activated', activated_at: new Date().toISOString(), clawback_deadline: clawbackDeadline })
            }
          );
          // Award ₹50 credit to referrer
          const rrRes = await fetch(
            `${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(ref.referrer_email)}&select=referral_credits`,
            { headers: sbHeaders() }
          );
          const rrRows = await rrRes.json();
          const currentCredits = (rrRows?.[0]?.referral_credits) || 0;
          await fetch(
            `${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(ref.referrer_email)}`,
            {
              method: 'PATCH',
              headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
              body: JSON.stringify({ referral_credits: currentCredits + 50 })
            }
          );
        }
      } catch(refErr) {
        console.error('Referral activation error (non-fatal):', refErr.message);
      }

      res.status(200).json({ success: true, plan: 'full_view', expiresAt });

    } else {
      // Per-use module — fetch current credits, increment by 1, save back
      const credRes = await fetch(`${userUrl}&select=module_credits`, { headers: sbHeaders() });
      const credRows = await credRes.json();
      const current = (credRows?.[0]?.module_credits) || {};
      current[plan] = (current[plan] || 0) + 1;

      await fetch(userUrl, {
        method: 'PATCH',
        headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ module_credits: current })
      });
      res.status(200).json({ success: true, module: plan, credits: current[plan] });
    }
  } catch(e) {
    console.error('Cashfree verify error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
