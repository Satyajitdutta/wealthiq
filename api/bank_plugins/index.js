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

const plugins = [
  hdfc, icici, sbi, axis, kotak, bob, pnb, 
  indusind, yesbank, canara, unionbank, boi, idfc
];

/**
 * Route document text to the appropriate bank plugin parser.
 */
export function extractBankTransactions(docText) {
  const upperText = docText.substring(0, 5000).toUpperCase(); // Scan first few pages
  
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