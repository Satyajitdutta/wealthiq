// Artha-IQ — AMFI NAV Connector
// Fetches live mutual fund NAVs from AMFI India (free, no auth required).
// Data source: https://www.amfiindia.com/spages/NAVAll.txt
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

let navCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — AMFI updates once a day after 8pm

function fetchAMFIRaw() {
  return new Promise((resolve, reject) => {
    https.get('https://www.amfiindia.com/spages/NAVAll.txt', (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    }).on('error', reject);
  });
}

function parseAMFI(raw) {
  const lines = raw.split('\n');
  const funds = [];
  let currentCategory = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Category headers (e.g. "Open Ended Schemes(Equity Scheme - Large Cap Fund)")
    if (!trimmed.includes(';')) {
      currentCategory = trimmed;
      continue;
    }

    const parts = trimmed.split(';');
    if (parts.length < 5) continue;

    const [schemeCode, isinGrowth, isinDiv, schemeName, nav, , , navDate] = parts;
    const navNum = parseFloat(nav);
    if (isNaN(navNum) || navNum <= 0) continue;

    funds.push({
      schemeCode: schemeCode.trim(),
      isin: isinGrowth.trim() || null,
      schemeName: schemeName.trim(),
      nav: navNum,
      navDate: navDate?.trim() || null,
      category: currentCategory
    });
  }
  return funds;
}

async function getNavData() {
  const now = Date.now();
  if (navCache.data && now - navCache.fetchedAt < CACHE_TTL_MS) {
    return navCache.data;
  }
  const raw = await fetchAMFIRaw();
  const data = parseAMFI(raw);
  navCache = { data, fetchedAt: now };
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { q, schemeCode, isin, top } = req.query || {};

  try {
    const funds = await getNavData();

    // Single lookup by schemeCode or ISIN
    if (schemeCode) {
      const found = funds.find(f => f.schemeCode === schemeCode);
      return res.status(200).json({ success: true, fund: found || null });
    }
    if (isin) {
      const found = funds.find(f => f.isin === isin);
      return res.status(200).json({ success: true, fund: found || null });
    }

    // Search by name
    if (q) {
      const query = q.toLowerCase();
      const results = funds
        .filter(f => f.schemeName.toLowerCase().includes(query))
        .slice(0, 20);
      return res.status(200).json({ success: true, results, total: results.length });
    }

    // Top N by NAV value (for dashboard display)
    if (top) {
      const topN = funds.slice(0, parseInt(top) || 10);
      return res.status(200).json({ success: true, results: topN });
    }

    // Default: return summary stats
    return res.status(200).json({
      success: true,
      summary: {
        total_funds: funds.length,
        last_updated: navCache.fetchedAt ? new Date(navCache.fetchedAt).toISOString() : null,
        cached: !!(navCache.data)
      }
    });
  } catch (e) {
    console.error('[mcp-amfi] Error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
