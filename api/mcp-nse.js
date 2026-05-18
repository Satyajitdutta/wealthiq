// Artha-IQ — NSE Market Data Connector
// Fetches live equity data from NSE India public APIs (no auth required).
// Endpoints used are publicly accessible NSE data feeds.
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com'
};

// NSE requires a session cookie — fetch homepage first to get cookies
let nseSession = { cookies: '', fetchedAt: 0 };
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function fetchNSEPage() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://www.nseindia.com', { headers: NSE_HEADERS }, (res) => {
      const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      nseSession = { cookies, fetchedAt: Date.now() };
      res.resume();
      res.on('end', () => resolve(cookies));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('NSE session timeout')); });
  });
}

async function ensureNSESession() {
  if (!nseSession.cookies || Date.now() - nseSession.fetchedAt > SESSION_TTL_MS) {
    await fetchNSEPage();
  }
  return nseSession.cookies;
}

function fetchNSEAPI(path) {
  return new Promise(async (resolve, reject) => {
    try {
      const cookies = await ensureNSESession();
      const req = https.get(`https://www.nseindia.com${path}`, {
        headers: { ...NSE_HEADERS, 'Cookie': cookies }
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch (_) { reject(new Error('NSE response not JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('NSE API timeout')); });
    } catch (e) { reject(e); }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { type = 'indices', symbol } = req.query || {};

  try {
    let result;

    if (type === 'indices') {
      // Major Indian indices — Nifty 50, Nifty Bank, Sensex proxy
      const data = await fetchNSEAPI('/api/allIndices');
      const relevant = (data.data || []).filter(i =>
        ['NIFTY 50', 'NIFTY BANK', 'NIFTY MIDCAP 100', 'NIFTY NEXT 50', 'INDIA VIX'].includes(i.index)
      ).map(i => ({
        name: i.index,
        last: i.last,
        change: i.change,
        pChange: i.pChange,
        open: i.open,
        high: i.high,
        low: i.low,
        yearHigh: i.yearHigh,
        yearLow: i.yearLow
      }));
      result = { indices: relevant };
    }

    else if (type === 'quote' && symbol) {
      // Single stock quote
      const data = await fetchNSEAPI(`/api/quote-equity?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
      const q = data.priceInfo || {};
      result = {
        symbol: symbol.toUpperCase(),
        companyName: data.info?.companyName || symbol,
        lastPrice: q.lastPrice,
        change: q.change,
        pChange: q.pChange,
        open: q.open,
        high: q.intraDayHighLow?.max,
        low: q.intraDayHighLow?.min,
        yearHigh: q.weekHighLow?.max,
        yearLow: q.weekHighLow?.min,
        peRatio: data.metadata?.pdSymbolPe,
        sector: data.metadata?.industry
      };
    }

    else if (type === 'topgainers') {
      const data = await fetchNSEAPI('/api/live-analysis-variations?index=gainers&limit=10&type=percent');
      result = { gainers: (data.NIFTY?.data || []).slice(0, 10) };
    }

    else if (type === 'toplosers') {
      const data = await fetchNSEAPI('/api/live-analysis-variations?index=loosers&limit=10&type=percent');
      result = { losers: (data.NIFTY?.data || []).slice(0, 10) };
    }

    else {
      return res.status(400).json({ error: 'type must be: indices | quote | topgainers | toplosers' });
    }

    res.status(200).json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('[mcp-nse] Error:', e.message);
    // Graceful degradation — don't break the app if NSE is down
    res.status(200).json({ success: false, error: e.message, fallback: true });
  }
}
