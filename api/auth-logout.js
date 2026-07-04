// WealthIQ — Revoke session (set revoked=true for this token's jti)
import { getAuth, sbHeaders, SUPABASE_URL } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const user = await getAuth(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!user.jti) { res.status(200).json({ success: true }); return; } // old token, nothing to revoke

  const base = SUPABASE_URL();
  if (!base) { res.status(500).json({ error: 'SUPABASE_URL not configured' }); return; }

  try {
    await fetch(
      `${base}/rest/v1/auth_sessions?jti=eq.${encodeURIComponent(user.jti)}`,
      { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ revoked: true }) }
    );
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('[auth-logout]', e.message);
    res.status(500).json({ error: 'Logout failed' });
  }
}
