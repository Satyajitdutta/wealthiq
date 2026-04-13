// Referral system
// GET  — return user's referral code, credits, referral stats
// POST { action: 'apply', code } — apply someone else's referral code
import { getAuth, sbHeaders, SUPABASE_URL } from './_auth.js';
import crypto from 'crypto';

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char e.g. "A3F2C9B1"
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const user = getAuth(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const base = SUPABASE_URL();
  const userUrl = `${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(user.email)}`;

  if (req.method === 'GET') {
    try {
      // Fetch user row
      const uRes = await fetch(`${userUrl}&select=referral_code,referred_by,referral_credits`, { headers: sbHeaders() });
      const uRows = await uRes.json();
      let row = uRows?.[0] || {};

      // Generate code if not set
      if (!row.referral_code) {
        const code = generateCode();
        await fetch(userUrl, {
          method: 'PATCH',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({ referral_code: code })
        });
        row.referral_code = code;
      }

      // Referrals made by this user
      const rRes = await fetch(
        `${base}/rest/v1/wealthiq_referrals?referral_code=eq.${row.referral_code}&select=referee_email,status,activated_at`,
        { headers: sbHeaders() }
      );
      const referrals = await rRes.json();

      res.status(200).json({
        code: row.referral_code,
        credits: row.referral_credits || 0,
        referredBy: row.referred_by || null,
        referrals: Array.isArray(referrals) ? referrals : []
      });
    } catch(e) {
      console.error('referral GET error:', e.message);
      res.status(500).json({ error: 'Failed to load referral info' });
    }
    return;
  }

  if (req.method === 'POST') {
    let body;
    try {
      if (typeof req.body === 'object' && req.body !== null) body = req.body;
      else body = JSON.parse(await new Promise(r => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>r(d)); }));
    } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }

    if (body.action === 'apply') {
      const code = (body.code || '').trim().toUpperCase();
      if (!code || code.length !== 8) { res.status(400).json({ error: 'Invalid referral code' }); return; }

      try {
        // Check user hasn't already used a referral code
        const uRes = await fetch(`${userUrl}&select=referral_code,referred_by`, { headers: sbHeaders() });
        const uRows = await uRes.json();
        const row = uRows?.[0] || {};

        if (row.referred_by) { res.status(400).json({ error: 'You have already used a referral code' }); return; }
        if (row.referral_code === code) { res.status(400).json({ error: 'You cannot use your own referral code' }); return; }

        // Check code exists
        const cRes = await fetch(
          `${base}/rest/v1/wealthiq_users?referral_code=eq.${code}&select=email`,
          { headers: sbHeaders() }
        );
        const cRows = await cRes.json();
        if (!cRows?.[0]) { res.status(404).json({ error: 'Referral code not found' }); return; }

        // Apply code — create pending referral row
        await fetch(userUrl, {
          method: 'PATCH',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({ referred_by: code })
        });

        await fetch(`${base}/rest/v1/wealthiq_referrals`, {
          method: 'POST',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            referral_code: code,
            referrer_email: cRows[0].email,
            referee_email: user.email,
            status: 'pending'
          })
        });

        res.status(200).json({ success: true, discount: 50 });
      } catch(e) {
        console.error('referral apply error:', e.message);
        res.status(500).json({ error: 'Failed to apply code' });
      }
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
