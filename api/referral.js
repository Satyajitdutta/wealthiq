// Referral system — user-to-user and partner/affiliate codes
// GET  — return user's referral code, credits, referral stats
// POST { action: 'apply', code } — apply a user or partner referral code
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
      const uRes = await fetch(`${userUrl}&select=referral_code,referred_by,referral_credits,partner_code`, { headers: sbHeaders() });
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

      // Partner code discount amount (if applied)
      let partnerDiscount = null;
      if (row.partner_code) {
        const pRes = await fetch(
          `${base}/rest/v1/wealthiq_partners?code=eq.${encodeURIComponent(row.partner_code)}&select=label,discount_amount`,
          { headers: sbHeaders() }
        );
        const pRows = await pRes.json();
        if (pRows?.[0]) {
          partnerDiscount = { code: row.partner_code, label: pRows[0].label, discount: pRows[0].discount_amount };
        }
      }

      res.status(200).json({
        code: row.referral_code,
        credits: row.referral_credits || 0,
        referredBy: row.referred_by || null,
        partnerCode: row.partner_code || null,
        partnerDiscount,
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
      if (!code || code.length < 4 || code.length > 20) {
        res.status(400).json({ error: 'Invalid code' }); return;
      }

      try {
        // Check user's current state
        const uRes = await fetch(`${userUrl}&select=referral_code,referred_by,partner_code`, { headers: sbHeaders() });
        const uRows = await uRes.json();
        const row = uRows?.[0] || {};

        if (row.referred_by && row.partner_code) {
          res.status(400).json({ error: 'You have already applied a referral code' }); return;
        }

        // --- Try user referral code first (8-char hex) ---
        if (code.length === 8 && !row.referred_by) {
          if (row.referral_code === code) {
            res.status(400).json({ error: 'You cannot use your own referral code' }); return;
          }
          const cRes = await fetch(
            `${base}/rest/v1/wealthiq_users?referral_code=eq.${code}&select=email`,
            { headers: sbHeaders() }
          );
          const cRows = await cRes.json();
          if (cRows?.[0]) {
            // Valid user referral code — apply it
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
            res.status(200).json({ success: true, type: 'user', discount: 50 });
            return;
          }
        }

        // --- Try partner code ---
        if (!row.partner_code) {
          const pRes = await fetch(
            `${base}/rest/v1/wealthiq_partners?code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,label,discount_amount`,
            { headers: sbHeaders() }
          );
          const pRows = await pRes.json();
          if (pRows?.[0]) {
            const partner = pRows[0];
            await fetch(userUrl, {
              method: 'PATCH',
              headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
              body: JSON.stringify({ partner_code: partner.code })
            });
            res.status(200).json({ success: true, type: 'partner', discount: partner.discount_amount, label: partner.label });
            return;
          }
        }

        res.status(404).json({ error: 'Code not found or already applied' });
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
