// Artha-IQ × SBI — Mutual Fund Statement Intelligence (CAMS / KFin)
// Extracts structured portfolio data from CAMS or KFintech consolidated account statements
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

function buildMFPrompt() {
  return `You are an Indian mutual fund statement parser. Extract structured portfolio data from CAMS or KFin (KFintech) consolidated account statements (CAS).
Return ONLY valid JSON. No markdown, no explanation.

Schema:
{
  "doc_type": "mf_statement",
  "source": "CAMS | KFin | Unknown",
  "investor_name": "string",
  "pan": "string",
  "email": "string",
  "mobile": "string",
  "statement_period_from": "YYYY-MM-DD or null",
  "statement_period_to": "YYYY-MM-DD or null",
  "folios": [
    {
      "folio_number": "string",
      "fund_house": "string",
      "scheme_name": "string",
      "scheme_type": "equity | debt | hybrid | liquid | elss | index | fof | other",
      "plan": "direct | regular",
      "option": "growth | idcw | dividend",
      "isin": "string",
      "units": 0.0,
      "nav": 0.0,
      "nav_date": "YYYY-MM-DD or null",
      "current_value": 0,
      "cost_value": 0,
      "unrealised_gain_loss": 0,
      "xirr": 0.0,
      "sip_active": false,
      "sip_amount": 0,
      "sip_frequency": "monthly | quarterly | none",
      "first_investment_date": "YYYY-MM-DD or null",
      "last_transaction_date": "YYYY-MM-DD or null"
    }
  ],
  "summary": {
    "total_invested": 0,
    "total_current_value": 0,
    "total_unrealised_gain_loss": 0,
    "overall_xirr": 0.0,
    "total_sip_monthly": 0,
    "elss_invested": 0,
    "elss_current_value": 0,
    "equity_value": 0,
    "debt_value": 0,
    "hybrid_value": 0,
    "liquid_value": 0,
    "number_of_folios": 0,
    "number_of_fund_houses": 0
  },
  "tax_summary": {
    "ltcg_applicable": 0,
    "stcg_applicable": 0,
    "elss_locked_till": "YYYY-MM-DD or null"
  },
  "is_valid_mf_document": true,
  "invalid_reason": "",
  "confidence": 0.95
}

Rules:
- All money values as plain numbers in INR (no symbols or commas). Units to 3 decimal places. NAV to 4 decimal places.
- scheme_type: ELSS = "elss". Index funds = "index". Liquid/overnight = "liquid". Otherwise by fund category.
- summary.total_sip_monthly = sum of all active SIPs converted to monthly equivalent.
- summary.elss_invested = total cost value of all ELSS folios (for 80C tracking).
- tax_summary: LTCG on equity >12 months, STCG on equity <=12 months (approximate from last_transaction_date).
- is_valid_mf_document must be false if not a CAMS/KFin MF statement.
- Return ONLY the JSON object.`;
}

function callGemini(parts, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ ok: true, raw }));
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

function parseResponse(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.error) throw new Error(parsed.error.message);
  const parts = parsed?.candidates?.[0]?.content?.parts || [];
  let text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
  if (!text) text = parts.filter(p => p.text).map(p => p.text).join('').trim();
  if (!text) throw new Error('Empty response');
  try { return JSON.parse(text); } catch (_) {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return JSON.parse(fence[1].trim());
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) return JSON.parse(text.slice(s, e + 1).replace(/,\s*([\]}])/g, '$1'));
  throw new Error('No JSON found');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
  } catch (_) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const { mimeType, data, docText, images } = body;
  if (!docText && !images && (!mimeType || !data)) {
    return res.status(400).json({ error: 'Missing document data' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const prompt = buildMFPrompt();
  let parts;
  if (docText) {
    parts = [{ text: `MUTUAL FUND STATEMENT:\n${docText}` }, { text: prompt }];
  } else if (images?.length) {
    parts = [{ text: 'Analyse this mutual fund statement.' }, ...images.map(i => ({ inlineData: { mimeType: i.mimeType || 'image/jpeg', data: i.data } })), { text: prompt }];
  } else {
    parts = [{ inlineData: { mimeType, data } }, { text: prompt }];
  }

  let extracted, lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) await new Promise(r => setTimeout(r, 1500));
      const result = await callGemini(parts, apiKey);
      if (!result.ok) throw new Error(result.error);
      extracted = parseResponse(result.raw);
      if (extracted?.is_valid_mf_document === false) {
        return res.status(200).json({ success: false, error: extracted.invalid_reason || 'Not a valid MF statement' });
      }
      break;
    } catch (e) {
      lastError = e;
      console.warn(`[doc-mf] Attempt ${attempt} failed: ${e.message}`);
    }
  }

  if (!extracted) {
    return res.status(200).json({ success: false, errorCode: 'parse_error', error: lastError?.message || 'Extraction failed' });
  }

  res.status(200).json({ success: true, extracted });
}
