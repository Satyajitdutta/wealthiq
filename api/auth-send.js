// WealthIQ — Send OTP via email (stateless HMAC, no DB needed)
import { createHmac } from 'crypto';
import { Resend } from 'resend';

function getOTP(secret, email, bucket) {
  const h = createHmac('sha256', secret).update(`${email}:${bucket}`).digest('hex');
  return String(parseInt(h.slice(-8), 16) % 1000000).padStart(6, '0');
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email required' }); return;
  }

  // Demo account — no email sent, fixed OTP
  if (email === 'user@test.com') { res.status(200).json({ success: true }); return; }

  const secret = (process.env.AUTH_SECRET || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (!secret || !resendKey) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  const bucket = Math.floor(Date.now() / 300000); // 5-min buckets
  const otp = getOTP(secret, email, bucket);

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'Pithonix WealthIQ <noreply@pithonix.ai>',
      to: email,
      subject: `${otp} — your WealthIQ login code`,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#080d1a;color:#f1f5f9;padding:2rem;border-radius:16px;border:1px solid rgba(255,255,255,0.08)">
  <div style="margin-bottom:1.75rem;display:flex;align-items:center;gap:8px">
    <div style="width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4)"></div>
    <span style="font-size:0.9rem;font-weight:800;color:#3b82f6">Pithonix WealthIQ</span>
  </div>
  <h2 style="font-size:1.3rem;font-weight:700;margin:0 0 0.4rem;color:#f1f5f9">Your login code</h2>
  <p style="color:#94a3b8;margin:0 0 1.75rem;font-size:0.88rem;line-height:1.5">Use this one-time code to sign in. It expires in 5 minutes.</p>
  <div style="background:#111827;border:1px solid rgba(59,130,246,0.25);border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.75rem">
    <span style="font-size:2.4rem;font-weight:800;letter-spacing:0.35em;color:#3b82f6;font-variant-numeric:tabular-nums">${otp}</span>
  </div>
  <p style="color:#475569;font-size:0.78rem;margin:0;line-height:1.5">If you didn't request this code, you can safely ignore this email. Your account is secure.</p>
</div>
      `
    });
    res.status(200).json({ success: true });
  } catch(e) {
    console.error('OTP send error:', e.message);
    res.status(500).json({ error: 'Failed to send code' });
  }
}
