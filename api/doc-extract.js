// Artha-IQ — Smart Import: Document Intelligence Extractor
// Uses Gemini 3 Flash (April 2026 Stable) — vision + PDF inline data.
// Extracts structured financial data from salary slips, Form 16, bank statements.
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';
import { extractBankTransactions } from './bank_plugins/index.js';

// ── City tier mapping & utility providers by region ──────────────────
const CITY_TIER_MAP = {
  // Tier 1 — National metros
  'bangalore': 'tier1', 'bengaluru': 'tier1',
  'mumbai': 'tier1', 'delhi': 'tier1', 'ncr': 'tier1',
  'hyderabad': 'tier1', 'kolkata': 'tier1', 'pune': 'tier1',
  'chennai': 'tier1', 'ahmedabad': 'tier1', 'jaipur': 'tier1',
  // Tier 2 — Important cities
  'lucknow': 'tier2', 'chandigarh': 'tier2', 'bhopal': 'tier2',
  'indore': 'tier2', 'coimbatore': 'tier2', 'kochi': 'tier2',
  'gurgaon': 'tier1', 'noida': 'tier1', 'faridabad': 'tier1',
  'ghaziabad': 'tier2', 'ludhiana': 'tier2', 'agra': 'tier2',
};

const UTILITY_PROVIDERS_BY_CITY = {
  'hyderabad': {
    electricity: ['TPDDL', 'TSSPDCL', 'TGGENCO', 'Telangana Power'],
    water: ['HMWSSB', 'Hyderabad Metro Water Supply'],
    gas: ['Indraprastha Gas', 'TS Gas', 'Bharat Gas'],
    internet: ['ACT Fibernet', 'Beam Telecom', 'Excitel', 'Spectranet'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  'bangalore': {
    electricity: ['BESCOM', 'Bangalore Electric', 'KERC'],
    water: ['BWSSB', 'Bangalore Water Supply'],
    gas: ['Indraprastha Gas', 'Bharat Gas', 'HP Gas'],
    internet: ['ACT Fibernet', 'Airtel Broadband', 'Jio Fiber', 'Excitel'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  'delhi': {
    electricity: ['TPDDL', 'TPDDL', 'BRPL', 'BYPL'],
    water: ['DJB', 'Delhi Jal Board'],
    gas: ['IGL', 'Indraprastha Gas'],
    internet: ['Airtel Broadband', 'ACT Fibernet', 'Jio Fiber', 'Excitel'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  'mumbai': {
    electricity: ['MSEDCL', 'BEST', 'Mahavitran', 'PowerGrid'],
    water: ['MCGM', 'Mumbai Municipal Corporation'],
    gas: ['IGL', 'Indraprastha Gas', 'Bharat Gas'],
    internet: ['ACT Fibernet', 'Airtel Broadband', 'Hathway', 'You Broadband'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  'chennai': {
    electricity: ['TANGEDCO', 'Chennai Electricity'],
    water: ['CMWSSB', 'Chennai Metro Water Supply'],
    gas: ['Indraprastha Gas', 'Bharat Gas'],
    internet: ['ACT Fibernet', 'Airtel Broadband', 'Jio Fiber', 'Spectranet'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
};

function getCityTier(cityName) {
  if (!cityName) return 'tier1';
  const city = cityName.toLowerCase().trim();
  return CITY_TIER_MAP[city] || 'tier1';
}

function getUtilityProviders(cityName) {
  if (!cityName) return UTILITY_PROVIDERS_BY_CITY['hyderabad'];
  const city = cityName.toLowerCase().trim();
  return UTILITY_PROVIDERS_BY_CITY[city] || UTILITY_PROVIDERS_BY_CITY['bangalore'];
}

function buildCityContextPrompt(cityName) {
  if (cityName && UTILITY_PROVIDERS_BY_CITY[cityName.toLowerCase()]) {
    const providers = getUtilityProviders(cityName);
    return `
User's city: ${cityName}
Identify recurring charges for:
- Electricity: ${providers.electricity.join(', ')}
- Water: ${providers.water.join(', ')}
- Gas: ${providers.gas.join(', ')}
- Internet: ${providers.internet.join(', ')}
- Mobile: ${providers.mobile.join(', ')}
- Insurance: ${providers.insurance.join(', ')}
- Subscriptions: ${providers.others.join(', ')}`;
  }
  return `Intelligently identify recurring utility/EMI charges and return structure.`;
}

function buildExtractPrompt(cityContext = '', merchantsListStr = '') {
  const merchantInstruction = merchantsListStr ? 
    '\nMap these unique merchants to appropriate categories (e.g., Subscription, Utility, EMI, Shopping, Other):\n[' + merchantsListStr + ']\n' : '';

  return 'You are a financial extraction engine. Extract financial data from salary slips, Form 16, or bank statements.\n' +
'Return ONLY valid JSON.\n\n' +
'Schema:\n' +
'{\n' +
'  "doc_type": "salary_slip" | "form_16" | "bank_statement" | "unknown",\n' +
'  "confidence": number,\n' +
'  "employee_name": string,\n' +
'  "employer_name": string,\n' +
'  "designation": string,\n' +
'  "month_year": string,\n' +
'  "city": string,\n' +
'  "take_home": number,\n' +
'  "gross_salary": number,\n' +
'  "basic": number,\n' +
'  "hra": number,\n' +
'  "pf_employee": number,\n' +
'  "tds_monthly": number,\n' +
'  "annual_income": number,\n' +
'  "tax_regime": "new" | "old",\n' +
'  "section_80c": number,\n' +
'  "section_80d": number,\n' +
'  "nps_80ccd": number,\n' +
'  "monthly_inflow": number,\n' +
'  "monthly_outflow": number,\n' +
'  "avg_balance": number,\n' +
'  "closing_balance": number,\n' +
'  "emi_total": number,\n' +
'  "merchant_categories": { "Unique Merchant Name From List": "Category" },\n' +
'  "fields_extracted": number,\n' +
'  "is_valid_financial_document": boolean,\n' +
'  "invalid_reason": string\n' +
'}\n\n' +
'Rules:\n' +
'- Plain numbers, no symbols.\n' +
'- Sum high-confidence EMIs and recurring utilities separately.\n' +
'- merchant_categories MUST strictly be a dictionary mapping the provided short list of UNIQUE merchants to categories. DO NOT extract full transactions.\n' +
'- is_valid_financial_document MUST be true ONLY if the document is an actual, legitimate bank statement, salary slip, or Form 16. If it is a dummy PDF, a generic template, or an unrelated document, set it to false and populate "invalid_reason".\n' +
'- Return ONLY the JSON object.\n\n' +
cityContext + merchantInstruction;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try {
    body = (typeof req.body === 'object' && req.body !== null) ? req.body : JSON.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { mimeType, data, docText, images, city } = body;
  if (!docText && !images && (!mimeType || !data)) {
    return res.status(400).json({ error: 'Missing document data' });
  }

  let localTxData = null;
  let merchantsListStr = '';
  if (docText) {
    localTxData = extractBankTransactions(docText);
    if (localTxData && localTxData.uniqueMerchants && localTxData.uniqueMerchants.length > 0) {
      merchantsListStr = localTxData.uniqueMerchants.join(', ');
    }
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  // gemini-2.5-flash with thinkingBudget:0 — disables thinking mode entirely.
  // When thinking is enabled (default), the model sometimes exhausts its token budget
  // on internal reasoning and returns empty text output, causing parse_error.
  // With thinkingBudget:0: fast, deterministic, and responseMimeType:json works correctly.
  const modelName = 'gemini-2.5-flash';

  const cityContext = city ? buildCityContextPrompt(city) : buildCityContextPrompt('hyderabad');
  const extractPrompt = buildExtractPrompt(cityContext, merchantsListStr);

  let parts;
  if (docText) {
    parts = [{ text: `DOCUMENT TEXT:\n${docText}` }, { text: extractPrompt }];
  } else if (images && Array.isArray(images) && images.length > 0) {
    parts = [
      { text: `Analyse this page.` },
      ...images.map(img => ({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data } })),
      { text: extractPrompt }
    ];
  } else {
    parts = [{ inlineData: { mimeType, data } }, { text: extractPrompt }];
  }

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',  // safe when thinkingBudget:0
      thinkingConfig: { thinkingBudget: 0 }  // disable thinking for reliable JSON output
    }
  });

  // Wraps Gemini call in a Promise; retries once on parse failure
  const callGemini = () => new Promise((resolve) => {
    const geminiReq = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (geminiRes) => {
      geminiRes.setEncoding('utf8');
      let raw = '';
      geminiRes.on('data', c => raw += c);
      geminiRes.on('end', () => resolve({ ok: true, raw }));
    });
    geminiReq.on('error', e => resolve({ ok: false, error: e.message }));
    geminiReq.write(geminiBody);
    geminiReq.end();
  });

  const parseGeminiRaw = (raw) => {
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(parsed.error.message || 'Gemini API Error');

    const candidateParts = parsed?.candidates?.[0]?.content?.parts || [];
    const finishReason  = parsed?.candidates?.[0]?.finishReason || 'UNKNOWN';
    console.log(`[doc-extract] Gemini parts=${candidateParts.length} finishReason=${finishReason}`);

    // With responseMimeType:'application/json', the model returns clean JSON directly.
    // Collect all non-thought text parts.
    let text = candidateParts
      .filter(p => !p.thought && p.text)
      .map(p => p.text)
      .join('')
      .trim();

    // Fallback: if model still mixed thinking in, grab any text
    if (!text) {
      text = candidateParts.filter(p => p.text).map(p => p.text).join('').trim();
    }

    if (!text) throw new Error('Empty response from Gemini');
    console.log(`[doc-extract] Raw text length: ${text.length}`);

    // Primary: direct JSON parse (works when responseMimeType is set)
    try { return JSON.parse(text); } catch(_) {}

    // Secondary: extract from fenced block
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

    // Tertiary: brace extraction
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s !== -1 && e > s) {
      const candidate = text.slice(s, e + 1)
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '');
      return JSON.parse(candidate);
    }

    console.error('[doc-extract] No JSON found. First 400 chars:', text.substring(0, 400));
    throw new Error('No JSON object found');
  };

  return new Promise(async (resolve) => {
    let extracted;
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[doc-extract] Retry attempt ${attempt}...`);
          await new Promise(r => setTimeout(r, 1500));
        }
        const result = await callGemini();
        if (!result.ok) throw new Error(result.error);
        extracted = parseGeminiRaw(result.raw);
        if (extracted && extracted.is_valid_financial_document === false) {
          extracted._is_invalid = true;
          throw new Error('INVALID_DOCUMENT: ' + (extracted.invalid_reason || 'The uploaded file is a dummy or unrelated document limit. Please upload an actual bank statement or salary slip.'));
        }
        break; // success
      } catch (e) {
        lastError = e;
        console.warn(`[doc-extract] Attempt ${attempt} failed: ${e.message}`);
        // Do not retry if we explicitly rejected the document as invalid
        if (e.message.startsWith('INVALID_DOCUMENT:')) {
          lastError = new Error(e.message.replace('INVALID_DOCUMENT: ', ''));
          break;
        }
      }
    }

    if (!extracted) {
      res.status(200).json({ success: false, errorCode: 'parse_error', error: lastError?.message || 'Extraction failed' });
      resolve();
      return;
    }

    // Reassembly step: combine local transactions with parsed categories
    if (localTxData && extracted && extracted.merchant_categories) {
      extracted.recurring_debits = [];
      for (const tx of localTxData.transactions) {
        for (const [merchant, category] of Object.entries(extracted.merchant_categories)) {
          const lCat = category.toLowerCase();
          const isRecurring = lCat.includes('subscription') || lCat.includes('utility') || lCat.includes('emi') || lCat.includes('insurance');
          if (isRecurring && tx.description.toUpperCase().includes(merchant.toUpperCase())) {
            extracted.recurring_debits.push({ name: merchant, amount: tx.amount, category, date: tx.date });
            break;
          }
        }
      }
    } else if (!extracted.recurring_debits) {
      extracted.recurring_debits = [];
    }

    res.status(200).json({ success: true, extracted });
    resolve();
  });
}
