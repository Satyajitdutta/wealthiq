// Save user financial profile to Supabase
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

  const base = SUPABASE_URL();
  if (!base) { res.status(500).json({ error: 'SUPABASE_URL not configured' }); return; }

  try {
    // Upsert user row first (ensure user exists)
    await fetch(`${base}/rest/v1/wealthiq_users`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email: user.email })
    });

    // Upsert profile
    await fetch(`${base}/rest/v1/wealthiq_profiles`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        email: user.email,
        profile_data: body.profile,
        updated_at: new Date().toISOString()
      })
    });

    res.status(200).json({ success: true });
  } catch(e) {
    console.error('Profile save error:', e.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
}
