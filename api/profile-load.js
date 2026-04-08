// Load user profile + plan from Supabase
import { getAuth, sbHeaders, SUPABASE_URL } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  const user = getAuth(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const base = SUPABASE_URL();
  if (!base) { res.status(500).json({ error: 'SUPABASE_URL not configured' }); return; }

  try {
    const [profileRes, userRes] = await Promise.all([
      fetch(`${base}/rest/v1/wealthiq_profiles?email=eq.${encodeURIComponent(user.email)}&select=profile_data`, {
        headers: sbHeaders()
      }),
      fetch(`${base}/rest/v1/wealthiq_users?email=eq.${encodeURIComponent(user.email)}&select=plan,plan_expires_at`, {
        headers: sbHeaders()
      })
    ]);

    const profiles = await profileRes.json();
    const users = await userRes.json();

    const profile = profiles?.[0]?.profile_data || null;
    const planRow = users?.[0];
    const plan = planRow?.plan || 'free';
    const planExpiresAt = planRow?.plan_expires_at || null;

    // Auto-downgrade if plan expired
    const activePlan = (plan !== 'free' && planExpiresAt && new Date(planExpiresAt) < new Date())
      ? 'free' : plan;

    res.status(200).json({ success: true, profile, plan: activePlan });
  } catch(e) {
    console.error('Profile load error:', e.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}
