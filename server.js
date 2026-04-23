import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Payload Limits (Railway bypasses Vercel 4.5MB limit) ──────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// ── Static Files ───────────────────────────────────────────────────
app.use(express.static(__dirname));

// ── API Routes (Standard Node Backend) ──────────────────────────────
async function mountRoutes() {
  const apiDir = path.join(__dirname, 'api');
  if (fs.existsSync(apiDir)) {
    const files = fs.readdirSync(apiDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const routeName = `/api/${file.replace('.js', '')}`;
        try {
          const { default: handler } = await import(`./api/${file}`);
          if (typeof handler === 'function') {
            app.all(routeName, handler);
            console.log(`[Server] Mounted: ${routeName}`);
          }
        } catch (err) {
          console.error(`[Server] Failed to mount ${file}:`, err);
        }
      }
    }
  }
}

// ── Page Rewrites (Mirroring vercel.json) ──────────────────────────
const REWRITES = {
  '/app': '/app.html',
  '/terms': '/terms.html',
  '/refund': '/refund.html',
  '/privacy': '/privacy.html',
  '/contact': '/contact.html'
};

Object.entries(REWRITES).forEach(([source, dest]) => {
  app.get(source, (req, res) => {
    res.sendFile(path.join(__dirname, dest));
  });
});

// ── Catch-all for API ──────────────────────────────────────────────
await mountRoutes();

// ── Listen ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Artha-IQ Backend Live on Railway`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Mode: Containerized`);
  console.log(`   Limit: 50MB (Vercel bypass enabled)\n`);
});
