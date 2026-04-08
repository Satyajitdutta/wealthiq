// Upload profile photo to Supabase Storage, return public URL
import { getAuth, SUPABASE_URL } from './_auth.js';

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
  });
}

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const user = getAuth(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let body;
  try { body = await readBody(req); } catch(e) { res.status(400).json({ error: 'Invalid request' }); return; }

  const { imageBase64 } = body;
  if (!imageBase64) { res.status(400).json({ error: 'imageBase64 required' }); return; }

  const base = SUPABASE_URL();
  if (!base) { res.status(500).json({ error: 'SUPABASE_URL not configured' }); return; }

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    // Use email as filename (sanitised), always jpeg
    const filename = user.email.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpg';

    const uploadRes = await fetch(`${base}/storage/v1/object/avatars/${filename}`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('Supabase storage error:', err);
      res.status(500).json({ error: 'Storage upload failed' }); return;
    }

    const publicUrl = `${base}/storage/v1/object/public/avatars/${filename}`;
    res.status(200).json({ success: true, url: publicUrl });
  } catch(e) {
    console.error('Avatar upload error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
}
