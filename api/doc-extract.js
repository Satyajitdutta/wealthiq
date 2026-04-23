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
'  "fields_extracted": number\n' +
'}\n\n' +
'Rules:\n' +
'- Plain numbers, no symbols.\n' +
'- Sum high-confidence EMIs and recurring utilities separately.\n' +
'- merchant_categories MUST strictly be a dictionary mapping the provided short list of UNIQUE merchants to categories. DO NOT extract full transactions.\n' +
'- Return ONLY the JSON object.\n\n' +
cityContext + merchantInstruction;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(240).end(); return; }
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
  // Using gemini-2.5-flash (stable, matches got-advice.js)
  const modelName = 'gemini-2.5-flash';
  // Note: 2.5-flash uses thinking tokens — thought parts are skipped in parsing below.

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
      responseMimeType: 'application/json'
    }
  });

  return new Promise((resolve) => {
    const geminiReq = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (geminiRes) => {
      geminiRes.setEncoding('utf8');
      let raw = '';
      geminiRes.on('data', c => raw += c);
      geminiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) throw new Error(parsed.error.message || 'Gemini API Error');

          const candidateParts = parsed?.candidates?.[0]?.content?.parts || [];
          const finishReason  = parsed?.candidates?.[0]?.finishReason || 'UNKNOWN';
          console.log(`[doc-extract] Gemini response: ${candidateParts.length} parts, finishReason=${finishReason}`);

          let text = '';
          for (const p of candidateParts) {
            if (p.thought) {
              console.log(`[doc-extract] Skipping thought part (${(p.text||'').length} chars)`);
              continue;
            }
            if (p.text) {
              text += p.text + '\n';
              console.log(`[doc-extract] Text part: ${p.text.substring(0, 120).replace(/\n/g,' ')}...`);
            }
          }

          // If no non-thought text, try including thought text as last resort
          if (!text.trim()) {
            console.warn('[doc-extract] No non-thought text found, trying thought parts...');
            for (const p of candidateParts) {
              if (p.text) text += p.text + '\n';
            }
          }

          if (!text.trim()) throw new Error('No response from Gemini');
          console.log(`[doc-extract] Full text length: ${text.length}`);

          // Robust JSON extraction — handles markdown fences, raw JSON, and leading noise
          let jsonStr = '';
          // 1. Try ```json ... ``` fence
          const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
            console.log('[doc-extract] Extracted via fence match');
          }
          // 2. Try outermost { ... }
          if (!jsonStr) {
            const s = text.indexOf('{');
            const e = text.lastIndexOf('}');
            if (s !== -1 && e !== -1 && e > s) {
              jsonStr = text.slice(s, e + 1);
              console.log('[doc-extract] Extracted via brace matching');
            }
          }

          if (!jsonStr) {
            console.error('[doc-extract] Raw response (first 500 chars):', text.substring(0, 500));
            throw new Error('No JSON object found');
          }

          let extracted;
          try {
            extracted = JSON.parse(jsonStr);
          } catch (parseErr) {
            console.warn('[doc-extract] Initial parse failed, attempting cleanup:', parseErr.message);
            // Remove trailing commas, control chars
            const cleaned = jsonStr
              .replace(/,\s*([\]}])/g, '$1')
              .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
              .replace(/\n/g, ' ');
            extracted = JSON.parse(cleaned);
          }

          // Reassembly step: Combine local transactions with parsed categories
          if (localTxData && extracted && extracted.merchant_categories) {
            extracted.recurring_debits = [];
            for (const tx of localTxData.transactions) {
              for (const [merchant, category] of Object.entries(extracted.merchant_categories)) {
                // Ensure the category is a relevant recurring one
                const lCat = category.toLowerCase();
                const isRecurring = lCat.includes('subscription') || lCat.includes('utility') || lCat.includes('emi') || lCat.includes('insurance');
                
                if (isRecurring && tx.description.toUpperCase().includes(merchant.toUpperCase())) {
                  extracted.recurring_debits.push({
                    name: merchant,
                    amount: tx.amount,
                    category: category,
                    date: tx.date
                  });
                  break; // Only map a transaction to one category
                }
              }
            }
          } else if (!extracted.recurring_debits) {
             extracted.recurring_debits = [];
          }

          res.status(200).json({ success: true, extracted });
        } catch (e) {
          console.error('[doc-extract] error:', e);
          res.status(200).json({ success: false, errorCode: 'parse_error', error: e.message });
        }
        resolve();
      });
    });
    geminiReq.on('error', e => { res.status(500).json({ error: e.message }); resolve(); });
    geminiReq.write(geminiBody);
    geminiReq.end();
  });
}
