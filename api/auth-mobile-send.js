// Artha-IQ — Send OTP via SMS (MSG91 gateway)
import { createHmac } from 'crypto';

function getOTP(secret, mobile, bucket) {
  const h = createHmac('sha256', secret).update(`mob:${mobile}:${bucket}`).digest('hex');
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

  const mobile = (body.mobile || '').replace(/\D/g, '').slice(0, 10);
  if (!mobile || mobile.length !== 10) {
    res.status(400).json({ error: 'Valid 10-digit mobile number required' }); return;
  }

  const secret   = (process.env.AUTH_SECRET   || '').trim();
  const msg91Key = (process.env.MSG91_AUTH_KEY || '').trim();

  if (!secret) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  const bucket = Math.floor(Date.now() / 300000); // 5-min window
  const otp    = getOTP(secret, mobile, bucket);

  // If MSG91 key not configured, return error
  if (!msg91Key) {
    res.status(503).json({ error: 'SMS service not configured. Please use email OTP.' }); return;
  }

  try {
    // MSG91 Send OTP API
    const msg91Res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'authkey': msg91Key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID || '',
        mobile: '91' + mobile,
        authkey: msg91Key,
        otp: otp,
        otp_expiry: 5,
        sender: process.env.MSG91_SENDER_ID || 'ARTHIQ'
      })
    });

    const result = await msg91Res.json();
    if (result.type === 'error') throw new Error(result.message || 'SMS sending failed');

    res.status(200).json({ success: true });
  } catch(e) {
    console.error('SMS OTP error:', e.message);
    res.status(500).json({ error: 'Could not send SMS. Try email OTP instead.' });
  }
}
