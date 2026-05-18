// Artha-IQ × SBI — Insurance Policy Document Intelligence
// Extracts structured data from any Indian insurance policy PDF (LIC, ICICI Pru, HDFC Life, etc.)
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

function buildInsurancePrompt() {
  return `You are an Indian insurance document parser. Extract structured data from insurance policy documents.
Return ONLY valid JSON. No markdown, no explanation.

Schema:
{
  "doc_type": "insurance_policy",
  "insurer": "LIC | ICICI Prudential | HDFC Life | SBI Life | Bajaj Allianz | Max Life | Tata AIA | New India | Star Health | Care Health | other",
  "policy_number": "string",
  "policy_type": "term | endowment | ulip | whole_life | health | critical_illness | vehicle | personal_accident | other",
  "insured_name": "string",
  "proposer_name": "string",
  "dob": "YYYY-MM-DD or null",
  "sum_assured": 0,
  "annual_premium": 0,
  "premium_frequency": "annual | semi-annual | quarterly | monthly | single",
  "premium_paying_term_years": 0,
  "policy_term_years": 0,
  "policy_start_date": "YYYY-MM-DD or null",
  "policy_end_date": "YYYY-MM-DD or null",
  "maturity_date": "YYYY-MM-DD or null",
  "next_premium_due": "YYYY-MM-DD or null",
  "riders": [],
  "nominee_name": "string",
  "nominee_relationship": "string",
  "loan_against_policy": 0,
  "surrender_value": 0,
  "bonus_accrued": 0,
  "is_active": true,
  "lapsed": false,
  "grace_period_days": 30,
  "free_look_period_days": 30,
  "coverage_summary": "one line plain English summary of what this policy covers",
  "gaps_identified": ["list any obvious gaps e.g. no critical illness rider, low sum assured"],
  "is_valid_insurance_document": true,
  "invalid_reason": "",
  "confidence": 0.95
}

Rules:
- All money values as plain numbers in INR, no symbols or commas.
- Dates in YYYY-MM-DD format. Use null if not found.
- policy_type: if it mentions term/death cover only = "term". If ULIPs/NAV/units = "ulip". If it covers hospitalisation = "health".
- is_valid_insurance_document must be false if document is not an insurance policy.
- Return ONLY the JSON object.`;
}

function callGemini(parts, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
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

  const prompt = buildInsurancePrompt();
  let parts;
  if (docText) {
    parts = [{ text: `INSURANCE POLICY DOCUMENT:\n${docText}` }, { text: prompt }];
  } else if (images?.length) {
    parts = [{ text: 'Analyse this insurance document.' }, ...images.map(i => ({ inlineData: { mimeType: i.mimeType || 'image/jpeg', data: i.data } })), { text: prompt }];
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
      if (extracted?.is_valid_insurance_document === false) {
        return res.status(200).json({ success: false, error: extracted.invalid_reason || 'Not a valid insurance document' });
      }
      break;
    } catch (e) {
      lastError = e;
      console.warn(`[doc-insurance] Attempt ${attempt} failed: ${e.message}`);
    }
  }

  if (!extracted) {
    return res.status(200).json({ success: false, errorCode: 'parse_error', error: lastError?.message || 'Extraction failed' });
  }

  res.status(200).json({ success: true, extracted });
}
