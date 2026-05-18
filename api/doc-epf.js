// Artha-IQ × SBI — EPF Passbook Document Intelligence
// Extracts structured data from EPFO passbook PDFs
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

function buildEPFPrompt() {
  return `You are an Indian EPF (Employees' Provident Fund) passbook parser. Extract structured data from EPFO passbook documents.
Return ONLY valid JSON. No markdown, no explanation.

Schema:
{
  "doc_type": "epf_passbook",
  "uan": "string",
  "member_id": "string",
  "member_name": "string",
  "dob": "YYYY-MM-DD or null",
  "employer_name": "string",
  "establishment_id": "string",
  "establishment_name": "string",
  "doj_epf": "YYYY-MM-DD or null",
  "doe_epf": "YYYY-MM-DD or null",
  "doj_eps": "YYYY-MM-DD or null",
  "doe_eps": "YYYY-MM-DD or null",
  "opening_balance_employee": 0,
  "opening_balance_employer": 0,
  "opening_balance_eps": 0,
  "total_employee_contribution": 0,
  "total_employer_contribution": 0,
  "total_eps_contribution": 0,
  "interest_credited_employee": 0,
  "interest_credited_employer": 0,
  "closing_balance_employee": 0,
  "closing_balance_employer": 0,
  "closing_balance_eps": 0,
  "total_epf_balance": 0,
  "total_eps_balance": 0,
  "grand_total_balance": 0,
  "financial_year": "YYYY-YY",
  "monthly_wage": 0,
  "monthly_employee_pf": 0,
  "monthly_employer_pf": 0,
  "years_of_service": 0,
  "eligible_for_pension": false,
  "pension_eligible_at": "YYYY-MM-DD or null",
  "nominations": [],
  "is_valid_epf_document": true,
  "invalid_reason": "",
  "confidence": 0.95
}

Rules:
- All money values as plain numbers in INR, no symbols or commas.
- total_epf_balance = closing_balance_employee + closing_balance_employer.
- grand_total_balance = total_epf_balance + total_eps_balance.
- years_of_service = years between doj_epf and statement date (approximate).
- eligible_for_pension = true if years_of_service >= 10.
- is_valid_epf_document must be false if not an EPF/EPFO document.
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

  const prompt = buildEPFPrompt();
  let parts;
  if (docText) {
    parts = [{ text: `EPF PASSBOOK DOCUMENT:\n${docText}` }, { text: prompt }];
  } else if (images?.length) {
    parts = [{ text: 'Analyse this EPF passbook.' }, ...images.map(i => ({ inlineData: { mimeType: i.mimeType || 'image/jpeg', data: i.data } })), { text: prompt }];
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
      if (extracted?.is_valid_epf_document === false) {
        return res.status(200).json({ success: false, error: extracted.invalid_reason || 'Not a valid EPF passbook' });
      }
      break;
    } catch (e) {
      lastError = e;
      console.warn(`[doc-epf] Attempt ${attempt} failed: ${e.message}`);
    }
  }

  if (!extracted) {
    return res.status(200).json({ success: false, errorCode: 'parse_error', error: lastError?.message || 'Extraction failed' });
  }

  res.status(200).json({ success: true, extracted });
}
