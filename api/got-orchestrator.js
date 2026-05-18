// Artha-IQ × SBI — GOT Orchestrator: Researcher → Modeler → Writer
// Replaces single-call GOT with a 3-phase focused agent chain.
// Phase 1 RESEARCHER: extracts relevant facts from profile + documents.
// Phase 2 MODELER: performs precise calculations on those facts.
// Phase 3 WRITER: produces the final GOT-format advice using exact numbers.
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

const INDIA_CONTEXT = `INDIA FINANCIAL CONTEXT (FY 2026-27):
- New Regime slabs: 0% ≤₹4L | 5% ₹4-8L | 10% ₹8-12L | 15% ₹12-16L | 20% ₹16-20L | 25% ₹20-24L | 30% >₹24L
- 87A rebate: New regime total income ≤₹12L = NIL tax | Old regime ≤₹5L = NIL tax
- Standard deduction: Old ₹50,000 | New ₹75,000
- 80C limit ₹1.5L | 80CCD(1B) NPS extra ₹50K | 80D: ₹25K self + ₹50K senior parents
- PPF rate 7.1% tax-free | SSY 8.2% | NPS equity ~11% long-term | EPF 8.25%
- Equity LTCG >1yr: 12.5% above ₹1.25L | STCG ≤1yr: 20%
- Debt MF LTCG/STCG: taxed at slab rate (post Apr 2023 rules)
- Term insurance rule: 15-20x annual income
- Health cover minimum: ₹5L per person, ₹10L+ recommended
- Safe inflation: 6% general | 8% medical | 10% education
- FIRE number: annual expenses × 25 (4% SWR)
- Govt schemes: PMJJBY ₹2L life cover ₹436/yr | PMSBY ₹2L accident ₹20/yr | PMJAY ₹5L health`;

function buildResearcherPrompt(query, profile, documents, intent) {
  return `You are the RESEARCHER in a 3-agent financial analysis pipeline. Your job is to identify and summarise ALL facts relevant to answering the user's query.

${INDIA_CONTEXT}

USER QUERY: "${query}"
INTENT: ${intent}

USER PROFILE:
${JSON.stringify(profile, null, 2)}

UPLOADED DOCUMENTS:
${JSON.stringify(documents, null, 2)}

YOUR TASK:
1. List every relevant data point from the profile and documents that pertains to the query.
2. Identify what is KNOWN (with values) vs UNKNOWN (missing data).
3. Flag any inconsistencies or red flags.
4. Note what calculations the MODELER will need to perform.

Return ONLY valid JSON:
{
  "query_interpreted": "one sentence: what the user is actually asking",
  "intent": "${intent}",
  "known_facts": {
    "income": { "annual": 0, "monthly_take_home": 0, "source": "profile|document|derived" },
    "tax": { "regime": "new|old", "estimated_annual_tax": 0, "80c_used": 0, "80c_remaining": 0, "80d_used": 0, "nps_used": 0 },
    "savings": { "monthly_savings": 0, "savings_rate_pct": 0, "emergency_fund": 0, "emergency_months": 0 },
    "investments": { "total_mf_value": 0, "total_epf_balance": 0, "total_sip_monthly": 0, "elss_invested": 0 },
    "insurance": { "total_life_cover": 0, "total_health_cover": 0, "annual_premium_total": 0, "policies_count": 0 },
    "loans": { "total_emi": 0, "home_loan_outstanding": 0, "other_loans": 0 },
    "goals": [],
    "age": 0,
    "life_stage": "string",
    "dependents": 0,
    "city": "string"
  },
  "gaps": ["list of missing data points that would improve analysis"],
  "red_flags": ["list of concerning findings e.g. no term cover, negative savings rate"],
  "calculations_needed": ["list of specific calculations the MODELER should perform"],
  "relevant_govt_schemes": ["schemes this person may be eligible for but not using"]
}`;
}

function buildModelerPrompt(query, researcherOutput) {
  return `You are the MODELER in a 3-agent financial analysis pipeline. The RESEARCHER has compiled the facts. You must now perform PRECISE CALCULATIONS.

${INDIA_CONTEXT}

USER QUERY: "${query}"

RESEARCHER OUTPUT:
${JSON.stringify(researcherOutput, null, 2)}

YOUR TASK: Perform every calculation listed in calculations_needed, plus any others relevant to this query. Be precise — use actual numbers from the researcher output. Show the logic for key calculations.

Return ONLY valid JSON:
{
  "calculations": {
    "tax": {
      "old_regime_tax": 0,
      "new_regime_tax": 0,
      "recommended_regime": "new|old",
      "tax_saving_by_switching": 0,
      "80c_gap_to_fill": 0,
      "potential_80c_saving": 0,
      "nps_additional_saving": 0,
      "total_potential_saving": 0
    },
    "insurance": {
      "term_cover_needed": 0,
      "term_cover_existing": 0,
      "term_cover_gap": 0,
      "health_cover_needed": 0,
      "health_cover_existing": 0,
      "health_cover_gap": 0,
      "estimated_term_annual_premium": 0
    },
    "retirement": {
      "fire_number": 0,
      "current_corpus": 0,
      "corpus_at_60_at_current_rate": 0,
      "shortfall": 0,
      "additional_monthly_sip_needed": 0,
      "years_to_retirement": 0
    },
    "goals": [],
    "sip": {
      "current_total_sip": 0,
      "recommended_total_sip": 0,
      "sip_gap": 0,
      "suggested_allocation": {}
    },
    "emergency_fund": {
      "recommended": 0,
      "current": 0,
      "gap": 0
    },
    "custom": {}
  },
  "key_numbers": [
    { "label": "string", "value": "string", "context": "string" }
  ],
  "top_opportunity": "single most impactful financial move with exact rupee benefit",
  "biggest_risk": "single biggest financial risk with exact rupee exposure"
}`;
}

function buildWriterPrompt(query, researcherOutput, modelerOutput, bankConfig) {
  const bankName = bankConfig?.name || 'Artha-IQ';
  return `You are the WRITER in a 3-agent financial analysis pipeline. The RESEARCHER compiled facts and the MODELER ran precise calculations. You must now produce a clear, actionable financial advice response.

USER QUERY: "${query}"

RESEARCHER OUTPUT:
${JSON.stringify(researcherOutput, null, 2)}

MODELER CALCULATIONS:
${JSON.stringify(modelerOutput, null, 2)}

YOUR TASK: Write the final GOT-format financial advice. Use ONLY the numbers from the modeler. Be specific. Be honest. Focus on actionability.
This response is for ${bankName}'s AI financial assistant — professional tone, India-specific, user-friendly.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence honest assessment using exact numbers from modeler",
  "overallScore": 0,
  "crossNodeInsight": "one compelling connection between two dimensions e.g. fixing Tax also improves Retirement by ₹X",
  "dimensions": [
    {
      "name": "Tax",
      "icon": "💰",
      "status": "ok|warning|danger",
      "headline": "specific headline with rupee number",
      "insight": "specific 1-2 sentence insight with numbers",
      "action": "specific actionable step with exact amount",
      "impact": "₹X/year saving or outcome"
    },
    {
      "name": "Insurance",
      "icon": "🛡️",
      "status": "ok|warning|danger",
      "headline": "specific headline",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Retirement",
      "icon": "🎯",
      "status": "ok|warning|danger",
      "headline": "specific headline",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Investments",
      "icon": "📈",
      "status": "ok|warning|danger",
      "headline": "specific headline",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Cashflow",
      "icon": "💧",
      "status": "ok|warning|danger",
      "headline": "specific headline",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Schemes",
      "icon": "🏛️",
      "status": "ok|warning|danger",
      "headline": "specific headline",
      "insight": "...",
      "action": "...",
      "impact": "..."
    }
  ],
  "topActions": [
    { "priority": 1, "action": "specific step", "impact": "₹X or outcome", "why": "one sentence", "timeToAct": "Today|This week|This month|This quarter" },
    { "priority": 2, "action": "...", "impact": "...", "why": "...", "timeToAct": "..." },
    { "priority": 3, "action": "...", "impact": "...", "why": "...", "timeToAct": "..." }
  ],
  "schemes": [
    { "name": "scheme name", "eligible": true, "benefit": "...", "cost": "...", "howToEnroll": "..." }
  ],
  "slash_response": {
    "headline": "direct answer to the query in one sentence",
    "details": "2-3 sentences with the key numbers",
    "next_step": "one specific action"
  }
}`;
}

async function callGemini(parts, apiKey, maxTokens = 8192, thinkingBudget = 0) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget }
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

function parseGeminiJSON(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.error) throw new Error(parsed.error.message || 'Gemini API error');
  const parts = parsed?.candidates?.[0]?.content?.parts || [];
  let text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
  if (!text) text = parts.filter(p => p.text).map(p => p.text).join('').trim();
  if (!text) throw new Error('Empty Gemini response');
  try { return JSON.parse(text); } catch (_) {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return JSON.parse(fence[1].trim());
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) return JSON.parse(text.slice(s, e + 1).replace(/,\s*([\]}])/g, '$1'));
  throw new Error('No JSON found in Gemini response');
}

function detectIntent(query) {
  const q = query.toLowerCase();
  if (q.startsWith('/tax') || q.includes('tax') || q.includes('80c') || q.includes('regime')) return 'tax';
  if (q.startsWith('/sip') || q.includes('sip') || q.includes('mutual fund') || q.includes('invest')) return 'sip';
  if (q.startsWith('/insurance') || q.includes('insurance') || q.includes('cover') || q.includes('policy')) return 'insurance';
  if (q.startsWith('/retire') || q.includes('retire') || q.includes('fire') || q.includes('corpus')) return 'retirement';
  if (q.startsWith('/goals') || q.includes('goal') || q.includes('target')) return 'goals';
  if (q.startsWith('/health') || q.includes('health score') || q.includes('financial health')) return 'health';
  return 'general';
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

  const { query = '', profile = {}, documents = {}, bankConfig = {} } = body;
  if (!query.trim()) return res.status(400).json({ error: 'query is required' });

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const intent = detectIntent(query);
  console.log(`[orchestrator] Query="${query.slice(0, 80)}" Intent="${intent}"`);

  try {
    // ── PHASE 1: RESEARCHER ───────────────────────────────────────────
    console.log('[orchestrator] Phase 1: Researcher');
    const researcherPrompt = buildResearcherPrompt(query, profile, documents, intent);
    const r1 = await callGemini([{ text: researcherPrompt }], apiKey, 4096, 0);
    if (!r1.ok) throw new Error(`Researcher failed: ${r1.error}`);
    const researcherOutput = parseGeminiJSON(r1.raw);
    console.log('[orchestrator] Researcher complete. Gaps:', researcherOutput.gaps?.length || 0);

    // ── PHASE 2: MODELER ──────────────────────────────────────────────
    console.log('[orchestrator] Phase 2: Modeler');
    const modelerPrompt = buildModelerPrompt(query, researcherOutput);
    const r2 = await callGemini([{ text: modelerPrompt }], apiKey, 4096, 0);
    if (!r2.ok) throw new Error(`Modeler failed: ${r2.error}`);
    const modelerOutput = parseGeminiJSON(r2.raw);
    console.log('[orchestrator] Modeler complete. Top opportunity:', modelerOutput.top_opportunity?.slice(0, 60));

    // ── PHASE 3: WRITER ───────────────────────────────────────────────
    console.log('[orchestrator] Phase 3: Writer');
    const writerPrompt = buildWriterPrompt(query, researcherOutput, modelerOutput, bankConfig);
    const r3 = await callGemini([{ text: writerPrompt }], apiKey, 8192, 2000);
    if (!r3.ok) throw new Error(`Writer failed: ${r3.error}`);
    const advice = parseGeminiJSON(r3.raw);
    console.log('[orchestrator] Writer complete. Score:', advice.overallScore);

    res.status(200).json({
      success: true,
      advice,
      meta: {
        intent,
        phases: ['researcher', 'modeler', 'writer'],
        gaps: researcherOutput.gaps || [],
        red_flags: researcherOutput.red_flags || []
      }
    });
  } catch (e) {
    console.error('[orchestrator] Error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
