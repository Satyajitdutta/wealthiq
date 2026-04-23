/**
 * Bank Plugin Router
 */
import * as hdfc from './hdfc.js';
import * as icici from './icici.js';
import * as sbi from './sbi.js';
import * as axis from './axis.js';
import * as kotak from './kotak.js';
import * as bob from './bob.js';
import * as pnb from './pnb.js';
import * as indusind from './indusind.js';
import * as yesbank from './yesbank.js';
import * as canara from './canara.js';
import * as unionbank from './unionbank.js';
import * as boi from './boi.js';
import * as idfc from './idfc.js';
import * as defaultPlugin from './default.js';

// Plugin order matters — more specific identifiers first.
// HDFC and SBI appear in other banks' transaction descriptions, so they go LAST.
const plugins = [
  axis, icici, kotak, indusind, yesbank, idfc,  // distinctive names unlikely in other banks' txns
  canara, unionbank, boi, bob, pnb,              // PSU banks
  sbi, hdfc                                      // LAST — names commonly appear in other banks' txns
];

/**
 * Route document text to the appropriate bank plugin parser.
 */
export function extractBankTransactions(docText) {
  // Scan only the first 400 chars — the issuing bank name is ALWAYS in the header (first 2-3 lines).
  // Scanning more chars risks matching other banks referenced in transaction descriptions
  // e.g. "HDFC HOME LOAN EMI" or "SBI NEFT TRANSFER" in an Axis Bank statement.
  const upperText = docText.substring(0, 400).toUpperCase();
  
  let selectedPlugin = defaultPlugin;
  
  for (const plugin of plugins) {
    for (const id of plugin.identifiers) {
      if (upperText.includes(id)) {
        selectedPlugin = plugin;
        console.log(`[BankPlugin] Detected Bank: ${id}`);
        break;
      }
    }
    if (selectedPlugin !== defaultPlugin) break;
  }
  
  if (selectedPlugin === defaultPlugin) {
    console.log('[BankPlugin] No specific bank detected. Using default fallback.');
  }

  // Parse using selected plugin
  const transactions = selectedPlugin.parser(docText);
  
  // Deduplicate to extract unique merchants
  // Heuristic: remove spaces, trailing numbers, generic words
  const uniqueMerchants = new Set();
  const rawMerchants = transactions.map(t => t.description);
  
  for (let m of rawMerchants) {
    // Keep first 30 chars, drop things like specific transaction IDs if possible
    let cleaned = m.substring(0, 30).replace(/[0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 3 && !cleaned.toLowerCase().includes('balance') && !cleaned.toLowerCase().includes('opening')) {
      uniqueMerchants.add(cleaned);
    }
  }
  
  return {
    transactions,
    uniqueMerchants: Array.from(uniqueMerchants)
  };
}