// Artha-IQ — RBI Financial Data Connector
// Fetches key RBI policy rates and economic indicators.
// Uses RBI's public data feeds — no authentication required.
// © 2026 PITHONIX AI INDIA PRIVATE LIMITED. All Rights Reserved.

import https from 'https';

// Hardcoded current rates as fallback — updated manually on RBI policy changes.
// These are FY 2026-27 values as of May 2026.
const FALLBACK_RATES = {
  repo_rate: 6.00,
  reverse_repo_rate: 3.35,
  crr: 4.00,
  slr: 18.00,
  bank_rate: 6.25,
  msf_rate: 6.25,
  cpi_inflation_latest: 4.83,
  gdp_growth_fy26: 6.5,
  usd_inr: 84.5,
  source: 'fallback',
  as_of: '2026-05-01',
  note: 'Fallback rates — live fetch unavailable'
};

// RBI DBIE API — publicly accessible
function fetchRBIData(seriesCode) {
  return new Promise((resolve, reject) => {
    const url = `https://rbidbie.rbi.org.in/service/api/DataService/getSeriesData?seriesCode=${seriesCode}&startDate=01-01-2026&endDate=31-12-2026`;
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ArthaIQ/1.0' }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

async function getRBIRates() {
  // Attempt live fetch from RBI DBIE
  try {
    const repoData = await fetchRBIData('RBINO_RR');
    if (repoData && repoData.data?.length) {
      const latest = repoData.data[repoData.data.length - 1];
      return {
        ...FALLBACK_RATES,
        repo_rate: parseFloat(latest.value) || FALLBACK_RATES.repo_rate,
        source: 'rbi_dbie',
        as_of: latest.date || FALLBACK_RATES.as_of,
        note: 'Live from RBI DBIE'
      };
    }
  } catch (_) {}

  // Return fallback on any failure
  return FALLBACK_RATES;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { type = 'rates' } = req.query || {};

  try {
    if (type === 'rates') {
      const rates = await getRBIRates();
      return res.status(200).json({ success: true, rates });
    }

    if (type === 'context') {
      // Financial planning context for GOT Orchestrator
      const rates = await getRBIRates();
      return res.status(200).json({
        success: true,
        context: {
          repo_rate: rates.repo_rate,
          inflation: rates.cpi_inflation_latest,
          fixed_deposit_approx: rates.repo_rate + 1.5,   // typical FD spread over repo
          home_loan_approx: rates.repo_rate + 2.5,        // typical home loan spread
          savings_account_approx: 3.5,
          ppf_rate: 7.1,
          scss_rate: 8.2,
          nsc_rate: 7.7,
          epf_rate: 8.25,
          asy_rate: 7.1,
          as_of: rates.as_of,
          source: rates.source
        }
      });
    }

    if (type === 'emi') {
      // EMI calculator using current home loan rates
      const { principal, years } = req.query;
      const p = parseFloat(principal);
      const n = parseFloat(years) * 12;
      if (!p || !n) return res.status(400).json({ error: 'principal and years required' });

      const rates = await getRBIRates();
      const r = (rates.repo_rate + 2.5) / 100 / 12; // monthly rate
      const emi = Math.round(p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
      const totalPayment = emi * n;
      const totalInterest = totalPayment - p;

      return res.status(200).json({
        success: true,
        emi,
        total_payment: totalPayment,
        total_interest: totalInterest,
        interest_rate_used: rates.repo_rate + 2.5,
        principal: p,
        tenure_months: n
      });
    }

    res.status(400).json({ error: 'type must be: rates | context | emi' });
  } catch (e) {
    console.error('[mcp-rbi] Error:', e.message);
    res.status(200).json({ success: true, rates: FALLBACK_RATES, fallback: true });
  }
}
