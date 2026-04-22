// Pithonix WealthIQ — GOT (Graph of Thought) Financial Reasoning Engine
// Receives user financial profile, builds multi-dimensional prompt, returns structured advice via Gemini

import https from 'https';

function buildGOTPrompt(profile) {
  return `You are WealthIQ, Pithonix AI's financial intelligence engine powered by Graph of Thought (GOT) reasoning. You think across multiple financial dimensions simultaneously and find connections between them.

USER FINANCIAL PROFILE:
${JSON.stringify(profile, null, 2)}

INDIA CONTEXT (FY 2026-27):
- New Regime slabs: 0% ≤₹4L | 5% ₹4-8L | 10% ₹8-12L | 15% ₹12-16L | 20% ₹16-20L | 25% ₹20-24L | 30% >₹24L
- 87A rebate: New regime total income ≤₹12L = NIL tax | Old regime ≤₹5L = NIL tax
- Standard deduction: Old ₹50,000 | New ₹75,000
- Key deductions: 80C ₹1.5L | 80CCD(1B) NPS ₹50K extra | 80D health ₹25K self + ₹50K senior parents
- PPF: 7.1% p.a. tax-free | Sukanya Samriddhi: 8.2% p.a. | NPS equity: ~11% long-term
- PMJAY: ₹5L annual health cover (income-based eligibility)
- PMSBY: ₹2L accident cover @ just ₹20/year (age 18-70)
- PMJJBY: ₹2L life cover @ ₹436/year (age 18-50)
- Atal Pension Yojana: Monthly pension ₹1K-5K after 60, for ages 18-40, especially informal workers
- Safe inflation rate India: 6% general | 8% medical | 10% education
- Recommended savings rate: 20-30% minimum | 30%+ for FIRE
- Term insurance rule: 15-20x annual income while working | 10x if within 10 years of retirement

GRAPH OF THOUGHT ANALYSIS — reason through each node and the connections between them:

NODE 1 — TAX OPTIMISATION:
The user has selected: ${profile.taxRegime === 'old' ? 'OLD REGIME' : 'NEW REGIME (default)'}.
Pre-calculated: Old regime tax = ₹${profile.oldTax?.toLocaleString('en-IN') || 'N/A'} | New regime tax = ₹${profile.newTax?.toLocaleString('en-IN') || 'N/A'}.
Focus ALL tax advice on optimising within their chosen ${profile.taxRegime} regime. Do NOT recommend switching regimes unless there is a saving of ₹50,000+. Show what deductions they are missing within their chosen regime only.

NODE 2 — GOALS ADEQUACY:
Calculate their FIRE number (monthly expenses × 12 × 25). Are their current SIPs enough? Which goal will they miss at current rate? What is the shortfall?

NODE 3 — INSURANCE GAPS:
Term cover needed = ${profile.annualSalary ? Math.round(profile.annualSalary * 15 / 100000) : 'calculate'} lakhs (15x annual income). Health cover needed = ₹5L per person minimum. What is their protection gap?

NODE 4 — GOVERNMENT SCHEMES:
Based on age ${profile.age}, life stage ${profile.lifeStage}, income, and family situation — which schemes is this person eligible for and NOT using? Be very specific.

NODE 5 — SPENDING & BEHAVIOUR:
Calculate their savings rate. What percentage of income is going to fixed obligations vs discretionary? What behavioural pattern is most hurting their wealth? Show 20-year compounding cost.

NODE 6 — LIFE STAGE INTELLIGENCE:
What is unique about being ${profile.age} years old with life stage ${profile.lifeStage}? What window of opportunity exists right now that will close in 3-5 years? What is the biggest risk they are not seeing?

CROSS-NODE CONNECTIONS (GOT reasoning):
After analysing each node, find the connections. Example: "Underutilised NPS (Tax node) = free ₹50K deduction = money that could also fund Retirement node. By fixing Tax, you simultaneously fix Goals." Find 2-3 such cross-node insights.

SYNTHESIS — TOP 3 ACTIONS:
Rank by impact × urgency. Be specific. Include exact rupee amounts.

${profile.priorityAnalysis ? `
PRIORITY ANALYSIS MODE (Annual Plan User):
This user receives a deeper analysis. Add the following extra sections:

INVESTMENT STRATEGY:
Based on their age (${profile.age}), risk appetite, existing corpus, and goals — what is the optimal asset allocation? Give specific percentages for equity MF, debt, gold, PPF/NPS, and emergency fund. Name 2-3 specific fund categories (not fund names).

30-DAY ACTION PLAN:
Give exactly 7 actions they can complete in the next 30 days, each with a specific week number (Week 1, Week 2, etc.). These must be actionable (can be done in 1-2 hours). Include the exact impact in rupees.

Add these fields to the JSON:
"investmentStrategy": {
  "allocation": [{"asset":"Equity MF","pct":50,"rationale":"Why"},...],
  "keyInsight": "One compelling reason for this specific allocation"
},
"monthlyActions": [
  {"action":"specific task","why":"reason","impact":"₹X or outcome","timeToAct":"Week 1"},
  ...7 items total
]
` : ''}

Return ONLY valid JSON with no markdown, no explanation, just the JSON object:
{
  "summary": "2-3 sentence honest assessment of their situation",
  "overallScore": 62,
  "crossNodeInsight": "One compelling connection between two dimensions, e.g. fixing X also fixes Y",
  "dimensions": [
    {
      "name": "Tax",
      "icon": "💰",
      "status": "warning",
      "headline": "Paying ₹18,200 — could be ₹0",
      "insight": "Specific insight in 1-2 sentences",
      "action": "Specific action with numbers",
      "impact": "Save ₹X/year"
    },
    {
      "name": "Goals",
      "icon": "🎯",
      "status": "danger",
      "headline": "FIRE corpus short by ₹X crore",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Insurance",
      "icon": "🛡️",
      "status": "danger",
      "headline": "₹X crore protection gap",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Schemes",
      "icon": "🏛️",
      "status": "warning",
      "headline": "3 schemes unused",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Spending",
      "icon": "💧",
      "status": "ok",
      "headline": "Savings rate X%",
      "insight": "...",
      "action": "...",
      "impact": "..."
    },
    {
      "name": "Life Stage",
      "icon": "🧭",
      "status": "ok",
      "headline": "Key opportunity window",
      "insight": "...",
      "action": "...",
      "impact": "..."
    }
  ],
  "topActions": [
    {
      "priority": 1,
      "action": "Specific action with exact steps",
      "impact": "Specific outcome in ₹ or years",
      "why": "One sentence connecting this to their biggest gap",
      "timeToAct": "Today"
    },
    {
      "priority": 2,
      "action": "...",
      "impact": "...",
      "why": "...",
      "timeToAct": "This month"
    },
    {
      "priority": 3,
      "action": "...",
      "impact": "...",
      "why": "...",
      "timeToAct": "This quarter"
    }
  ],
  "schemes": [
    {
      "name": "PMJJBY",
      "eligible": true,
      "benefit": "₹2L life cover",
      "cost": "₹436/year",
      "howToEnroll": "Visit your bank branch or net banking"
    }
  ]
}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let profile;
  try {
    if (typeof req.body === 'object') profile = req.body;
    else {
      const raw = await new Promise((resolve) => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
      });
      profile = JSON.parse(raw);
    }
  } catch(e) { res.status(400).json({ error: 'Invalid profile data' }); return; }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY not configured' }); return; }

  const prompt = buildGOTPrompt(profile);
  const isPriority = profile.priorityAnalysis === true;
  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: isPriority ? 0.4 : 0.3,
      maxOutputTokens: isPriority ? 16384 : 8192,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: isPriority ? 5000 : 0 }
    }
  });

  const path = `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    const geminiReq = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(geminiBody) }
    }, (geminiRes) => {
      let raw = '';
      geminiRes.on('data', c => raw += c);
      geminiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          let text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          console.log('Gemini status:', geminiRes.statusCode, '| text length:', text.length, '| preview:', text.slice(0, 120));
          // Strip markdown code fences if present
          text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          // Extract first valid JSON object
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON object found in response');
          const advice = JSON.parse(text.slice(start, end + 1));
          res.status(200).json({ success: true, advice });
        } catch(e) {
          console.error('Parse error:', e.message, '| raw length:', raw.length, '| raw start:', raw.slice(0, 300));
          res.status(500).json({ error: 'Failed to parse GOT response' });
        }
        resolve();
      });
    });
    geminiReq.on('error', (e) => { res.status(500).json({ error: e.message }); resolve(); });
    geminiReq.write(geminiBody);
    geminiReq.end();
  });
}
