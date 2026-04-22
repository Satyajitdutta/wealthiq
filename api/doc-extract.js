// Artha-IQ — Smart Import: Document Intelligence Extractor
// Uses Gemini 2.5 Flash (same key as GOT Advisor) — vision + PDF inline data.
// Extracts structured financial data from salary slips, Form 16, bank statements.
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

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
  // Add more as needed
};

const UTILITY_PROVIDERS_BY_CITY = {
  // ── HYDERABAD (Tier 1) ──
  'hyderabad': {
    electricity: ['TPDDL', 'TSSPDCL', 'TGGENCO', 'Telangana Power'],
    water: ['HMWSSB', 'Hyderabad Metro Water Supply'],
    gas: ['Indraprastha Gas', 'TS Gas', 'Bharat Gas'],
    internet: ['ACT Fibernet', 'Beam Telecom', 'Excitel', 'Spectranet'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  // ── BANGALORE (Tier 1) ──
  'bangalore': {
    electricity: ['BESCOM', 'Bangalore Electric', 'KERC'],
    water: ['BWSSB', 'Bangalore Water Supply'],
    gas: ['Indraprastha Gas', 'Bharat Gas', 'HP Gas'],
    internet: ['ACT Fibernet', 'Airtel Broadband', 'Jio Fiber', 'Excitel'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  // ── DELHI/NCR (Tier 1) ──
  'delhi': {
    electricity: ['TPDDL', 'TPDDL', 'BRPL', 'BYPL'],
    water: ['DJB', 'Delhi Jal Board'],
    gas: ['IGL', 'Indraprastha Gas'],
    internet: ['Airtel Broadband', 'ACT Fibernet', 'Jio Fiber', 'Excitel'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  // ── MUMBAI (Tier 1) ──
  'mumbai': {
    electricity: ['MSEDCL', 'BEST', 'Mahavitran', 'PowerGrid'],
    water: ['MCGM', 'Mumbai Municipal Corporation'],
    gas: ['IGL', 'Indraprastha Gas', 'Bharat Gas'],
    internet: ['ACT Fibernet', 'Airtel Broadband', 'Hathway', 'You Broadband'],
    mobile: ['Airtel', 'Jio', 'VI', 'Vodafone', 'BSNL'],
    insurance: ['LIC', 'ICICI Prudential', 'Bajaj', 'HDFC Life'],
    others: ['Netflix', 'Amazon Prime', 'Disney+', 'Spotify', 'Swiggy', 'Zomato']
  },
  // ── Chennai (Tier 1) ──
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
  return CITY_TIER_MAP[city] || 'tier1'; // default to tier1
}

function getUtilityProviders(cityName) {
  if (!cityName) return UTILITY_PROVIDERS_BY_CITY['hyderabad']; // fallback
  const city = cityName.toLowerCase().trim();
  return UTILITY_PROVIDERS_BY_CITY[city] || UTILITY_PROVIDERS_BY_CITY['bangalore'];
}

function buildCityContextPrompt(cityName) {
  // If city provided, use specific providers; else use comprehensive Tier-1 list
  if (cityName && UTILITY_PROVIDERS_BY_CITY[cityName.toLowerCase()]) {
    const providers = getUtilityProviders(cityName);
    return `
User's city: ${cityName}

For bank statements, identify recurring charges by these provider categories specific to this city:
- Electricity: ${providers.electricity.join(', ')}
- Water: ${providers.water.join(', ')}
- Gas: ${providers.gas.join(', ')}
- Internet: ${providers.internet.join(', ')}
- Mobile: ${providers.mobile.join(', ')}
- Insurance (premiums/debits): ${providers.insurance.join(', ')}
- Subscriptions: ${providers.others.join(', ')}

Recurring = appears monthly or on predictable dates. Sum these separately from EMI_TOTAL.`;
  }

  // Comprehensive Tier-1 fallback (covers Hyderabad, Bangalore, Delhi, Mumbai, Chennai)
  return `
For bank statements, intelligently identify recurring utilities by looking for these provider patterns:

ELECTRICITY (varies by city/state):
  - Telangana: TPDDL, TSSPDCL | Karnataka: BESCOM | Maharashtra: MSEDCL, BEST | Delhi: TPDDL, BRPL, BYPL | Tamil Nadu: TANGEDCO

WATER/MUNICIPAL:
  - Hyderabad: HMWSSB | Bangalore: BWSSB | Delhi: DJB | Mumbai: MCGM | Chennai: CMWSSB

GAS (LPG or piped):
  - Common: Indraprastha Gas, TS Gas, Bharat Gas, HP Gas | Look for: Gas, LPG, Indraprastha

INTERNET/BROADBAND:
  - Common: ACT Fibernet, Airtel Broadband, Jio Fiber, Excitel, Hathway, You Broadband, Spectranet

MOBILE/TELECOM:
  - Common: Airtel, Jio, VI, Vodafone, BSNL | Look for: "Airtel Mo", "Jio", "VI", mobile charges

INSURANCE (premiums, life, health):
  - Common: LIC, ICICI Prudential, Bajaj, HDFC Life, Max Life | Look for: "Insurance", "Premium", "LIC", company initials

SUBSCRIPTIONS & UTILITIES:
  - Common: Netflix, Amazon Prime, Disney+, Spotify, Swiggy, Zomato, Urban Company, etc.

FILTERING RULES — Only count as "recurring" if:
  1. FIXED AMOUNT: Same or similar amount each month (±10% variance acceptable)
  2. PREDICTABLE DATE: Same date each month or on a known billing cycle
  3. NON-DISCRETIONARY: Not a restaurant/store/shopping merchant (no "shop", "restaurant", "cafe", "market", "retail")
  4. KNOWN PROVIDER: Matches electricity, water, gas, insurance, or major subscription brands

EXCLUDE these (they're discretionary/occasional, not obligations):
  - Small merchants (pan shops, food stalls, local stores)
  - Groceries/shopping (Amazon, Swiggy, Zomato unless subscription plan)
  - Entertainment (PVR, cinema) unless subscription
  - Variable food delivery charges

CALCULATE:
  - emi_total = sum of loan EMIs only (Bajaj, LIC Housing, HDFC Bank, PPR, etc.)
  - recurring_utilities = sum of high-confidence recurring utilities ONLY (electricity, water, gas, insurance, mobile, broadband)
  - total_monthly_obligations = emi_total + recurring_utilities

Note: User will review and adjust via the manual form if needed.`;
}

function buildExtractPrompt(cityContext = '') {
  return `You are a financial data extraction engine for Artha-IQ, India's personal finance intelligence platform.

A user has uploaded a financial document. It is one of: salary slip, Form 16, or bank statement (Indian).

Extract every financial field you can identify. Return ONLY valid JSON — no explanation, no markdown, no code fences.

JSON schema (use null for any field not found in the document):
{
  "doc_type": "salary_slip" | "form_16" | "bank_statement" | "unknown",
  "confidence": <0.0 to 1.0 — how clearly readable is this document>,

  "employee_name":     <string | null>,
  "employer_name":     <string | null>,
  "designation":       <string | null>,
  "month_year":        <"MMM YYYY" | null>,
  "city":              <city name | null>,

  "take_home":         <monthly take-home pay in ₹ as a number | null>,
  "gross_salary":      <monthly gross salary in ₹ as a number | null>,
  "basic":             <monthly basic pay in ₹ as a number | null>,
  "hra":               <monthly HRA in ₹ as a number | null>,
  "special_allowance": <monthly special allowance in ₹ as a number | null>,
  "pf_employee":       <monthly employee PF deduction in ₹ as a number | null>,
  "professional_tax":  <monthly professional tax in ₹ as a number | null>,
  "tds_monthly":       <monthly TDS deducted in ₹ as a number | null>,

  "annual_income":     <total annual income in ₹ as a number | null>,
  "tax_regime":        <"new" | "old" | null>,
  "section_80c":       <annual 80C total in ₹ as a number | null>,
  "section_80d":       <annual 80D total in ₹ as a number | null>,
  "nps_80ccd":         <annual NPS 80CCD 1B in ₹ as a number | null>,
  "annual_tds":        <annual total TDS in ₹ as a number | null>,

  "avg_monthly_credit": <average monthly credit in ₹ as a number | null>,
  "avg_monthly_debit":  <average monthly debit in ₹ as a number | null>,
  "emi_total":          <estimated total monthly EMI payments (loans) in ₹ as a number | null>,
  "recurring_utilities": <estimated total monthly utilities (electricity, water, gas, internet, mobile, insurance, subscriptions) in ₹ as a number | null>,
  "total_monthly_obligations": <emi_total + recurring_utilities | null>,
  "recurring_debits":   [],

  "fields_extracted":   <integer count of non-null fields above, excluding doc_type, confidence, recurring_debits>
}

Rules:
- All monetary values must be plain numbers in Indian Rupees (no ₹ symbol, no commas).
- If the document shows annual figures, divide by 12 to get monthly values.
- For bank statements: identify EMIs as recurring loan/finance debits (Bajaj, HDFC Bank, LIC Housing, etc.).
- For bank statements: identify recurring utilities separately (electricity, water, gas, mobile, insurance, subscriptions) — check provider names below.
- recurring_utilities = sum of all non-EMI recurring debits. emi_total = loan EMIs only.
- total_monthly_obligations = emi_total + recurring_utilities
- Set confidence below 0.3 if the document is blurry, cut off, or unreadable.
- If it is not a financial document at all, set doc_type to "unknown" and confidence to 0.
- Return ONLY the JSON object. No text outside it.

${cityContext}`;
}

const EXTRACT_PROMPT_TEMPLATE = buildExtractPrompt();

A user has uploaded a financial document. It is one of: salary slip, Form 16, or bank statement (Indian).

Extract every financial field you can identify. Return ONLY valid JSON — no explanation, no markdown, no code fences.

JSON schema (use null for any field not found in the document):
{
  "doc_type": "salary_slip" | "form_16" | "bank_statement" | "unknown",
  "confidence": <0.0 to 1.0 — how clearly readable is this document>,

  "employee_name":     <string | null>,
  "employer_name":     <string | null>,
  "designation":       <string | null>,
  "month_year":        <"MMM YYYY" | null>,
  "city":              <city name | null>,

  "take_home":         <monthly take-home pay in ₹ as a number | null>,
  "gross_salary":      <monthly gross salary in ₹ as a number | null>,
  "basic":             <monthly basic pay in ₹ as a number | null>,
  "hra":               <monthly HRA in ₹ as a number | null>,
  "special_allowance": <monthly special allowance in ₹ as a number | null>,
  "pf_employee":       <monthly employee PF deduction in ₹ as a number | null>,
  "professional_tax":  <monthly professional tax in ₹ as a number | null>,
  "tds_monthly":       <monthly TDS deducted in ₹ as a number | null>,

  "annual_income":     <total annual income in ₹ as a number | null>,
  "tax_regime":        <"new" | "old" | null>,
  "section_80c":       <annual 80C total in ₹ as a number | null>,
  "section_80d":       <annual 80D total in ₹ as a number | null>,
  "nps_80ccd":         <annual NPS 80CCD 1B in ₹ as a number | null>,
  "annual_tds":        <annual total TDS in ₹ as a number | null>,

  "avg_monthly_credit": <average monthly credit in ₹ as a number | null>,
  "avg_monthly_debit":  <average monthly debit in ₹ as a number | null>,
  "emi_total":          <estimated total monthly EMI payments in ₹ as a number | null>,
  "recurring_debits":   [],

  "fields_extracted":   <integer count of non-null fields above, excluding doc_type, confidence, recurring_debits>
}

Rules:
- All monetary values must be plain numbers in Indian Rupees (no ₹ symbol, no commas).
- If the document shows annual figures, divide by 12 to get monthly values.
- For bank statements: identify EMIs as recurring fixed debits that appear every month.
- Set confidence below 0.3 if the document is blurry, cut off, or unreadable.
- If it is not a financial document at all, set doc_type to "unknown" and confidence to 0.
- Return ONLY the JSON object. No text outside it.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'POST only' }); return; }

  // Parse body (manual stream read to handle large base64 payloads)
  let body;
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      const raw = await new Promise((resolve, reject) => {
        let d = '';
        req.on('data',  c => d += c);
        req.on('end',   () => resolve(d));
        req.on('error', reject);
      });
      body = JSON.parse(raw);
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { mimeType, data, docText, city } = body;

  // Must have either image data OR extracted text
  if (!docText && (!mimeType || !data)) {
    return res.status(400).json({ error: 'Missing mimeType/data or docText' });
  }

  // Reject oversized image payloads (text payloads are always compact)
  if (data && data.length > 10_000_000) {
    return res.status(413).json({ error: 'File too large — please upload max 7 MB', errorCode: 'too_large' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  // Build city-aware extraction prompt
  const cityContext  = city ? buildCityContextPrompt(city) : buildCityContextPrompt('hyderabad');
  const extractPrompt = buildExtractPrompt(cityContext);

  // Build Gemini request — two modes:
  //   docText:  text parts only (digital PDFs — all pages, most accurate)
  //   data:     inlineData (images, scanned PDFs — vision model)
  let parts;
  if (docText) {
    // Text mode: full document text from all pages + extraction prompt
    parts = [
      { text: `BANK/FINANCIAL DOCUMENT TEXT (all pages):\n\n${docText}` },
      { text: extractPrompt }
    ];
    console.log('[doc-extract] mode: text | chars:', docText.length, '| city:', city || 'auto');
  } else {
    // Vision mode: inline image/PDF data
    parts = [
      { inlineData: { mimeType, data } },
      { text: extractPrompt }
    ];
    console.log('[doc-extract] mode: vision | mimeType:', mimeType, '| city:', city || 'auto');
  }

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature:      0.1,
      maxOutputTokens:  2048,   // increased: text mode returns richer detail
      responseMimeType: 'application/json'
    }
  });

  const path = `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    const geminiReq = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path,
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(geminiBody)
      }
    }, (geminiRes) => {
      let raw = '';
      geminiRes.on('data', c => raw += c);
      geminiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          let   text   = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';

          // Strip markdown fences if Gemini wraps anyway
          text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

          const start = text.indexOf('{');
          const end   = text.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON in Gemini response');

          const extracted = JSON.parse(text.slice(start, end + 1));
          console.log('[doc-extract] doc_type:', extracted.doc_type,
                      '| confidence:', extracted.confidence,
                      '| fields:', extracted.fields_extracted,
                      '| gemini status:', geminiRes.statusCode);

          // Detect encrypted/unreadable PDF from confidence + empty fields
          if ((extracted.confidence || 0) < 0.15 && !extracted.take_home && !extracted.annual_income && !extracted.avg_monthly_credit) {
            return res.status(200).json({
              success: false,
              errorCode: 'pdf_unreadable',
              error: 'Could not read document — it may be password-protected or unreadable'
            });
          }

          res.status(200).json({ success: true, extracted });
        } catch (e) {
          console.error('[doc-extract] parse error:', e.message, '| gemini status:', geminiRes.statusCode, '| raw:', raw.slice(0, 300));
          // If Gemini returned a non-200, it's likely an API-level error (encrypted PDF, bad format)
          const isEncryptedErr = raw.includes('INVALID_ARGUMENT') || raw.includes('unable to process') || raw.includes('encrypted');
          res.status(200).json({
            success: false,
            errorCode: isEncryptedErr ? 'pdf_unreadable' : 'parse_error',
            error: 'Could not extract data from this document'
          });
        }
        resolve();
      });
    });

    geminiReq.on('error', (e) => {
      console.error('[doc-extract] request error:', e.message);
      res.status(500).json({ error: e.message });
      resolve();
    });

    geminiReq.write(geminiBody);
    geminiReq.end();
  });
}
