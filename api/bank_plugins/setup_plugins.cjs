const fs = require('fs');
const path = require('path');

const pluginNames = [
  'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'bob', 'pnb', 
  'indusind', 'yesbank', 'canara', 'unionbank', 'boi', 'idfc'
];

const template = (name) => `
/**
 * Bank Plugin: ${name.toUpperCase()}
 */

export const identifiers = ['${name.toUpperCase()} BANK'];

export function parser(docText) {
  const debits = [];
  // Split by newline and attempt generic fallback transaction match
  // A typical transaction line contains: Date, Description, Amount (with possible balance)
  const lines = docText.split('\\n');
  const txRegex = /^(\\d{2}[\\/\\-]\\d{2}[\\/\\-]\\d{2,4})\\s+(.+?)\\s+([0-9,\\.]+)\\s+(?:(?:Cr|Dr|\\s+)?([0-9,\\.]+)?)?/i;

  for (const line of lines) {
    const match = line.match(txRegex);
    if (match) {
      const desc = match[2].trim();
      const amtStr = match[3].replace(/,/g, '');
      const amount = parseFloat(amtStr);
      
      // Basic filter: only consider debits (heuristically assuming debits are non-trivial amounts)
      if (!isNaN(amount) && amount > 0 && desc.length > 3) {
        debits.push({
          date: match[1],
          description: desc,
          amount: amount,
          type: 'debit'
        });
      }
    }
  }
  
  return debits;
}
`;

const defaultTemplate = `
/**
 * Bank Plugin: Default Fallback
 */

export const identifiers = [];

export function parser(docText) {
  const debits = [];
  const lines = docText.split('\\n');
  
  // Very generic pattern looking for dates at start of string
  // Format: DD-MM-YYYY or DD.MM.YY followed by description and amounts
  const txRegex = /^(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})\\s+(.+?)\\s+([0-9,\\.]+)(?=\\s|$)/i;

  for (const line of lines) {
    const match = line.match(txRegex);
    if (match) {
      const desc = match[2].trim();
      const amtStr = match[3].replace(/,/g, '');
      const amount = parseFloat(amtStr);
      
      if (!isNaN(amount) && amount > 10 && desc.length > 3) {
        debits.push({
          date: match[1],
          description: desc,
          amount: amount,
          type: 'debit'
        });
      }
    }
  }
  
  return debits;
}
`;

const indexTemplate = `
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
        console.log(\`[BankPlugin] Detected Bank: \${id}\`);
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
    let cleaned = m.substring(0, 30).replace(/[0-9]+/g, ' ').replace(/\\s+/g, ' ').trim();
    if (cleaned.length > 3 && !cleaned.toLowerCase().includes('balance') && !cleaned.toLowerCase().includes('opening')) {
      uniqueMerchants.add(cleaned);
    }
  }
  
  return {
    transactions,
    uniqueMerchants: Array.from(uniqueMerchants)
  };
}
`;

const dir = path.join(__dirname);

fs.writeFileSync(path.join(dir, 'default.js'), defaultTemplate.trim());
fs.writeFileSync(path.join(dir, 'index.js'), indexTemplate.trim());

for (const p of pluginNames) {
  let customizedTemplate = template(p);
  
  // Customize identifiers for each top bank
  if (p === 'sbi') customizedTemplate = customizedTemplate.replace("'SBI BANK'", "'STATE BANK OF INDIA', 'SBI'");
  if (p === 'icici') customizedTemplate = customizedTemplate.replace("'ICICI BANK'", "'ICICI BANK LTD', 'ICICI BANK'");
  if (p === 'hdfc') customizedTemplate = customizedTemplate.replace("'HDFC BANK'", "'HDFC BANK LTD', 'HDFC BANK'");
  if (p === 'axis') customizedTemplate = customizedTemplate.replace("'AXIS BANK'", "'AXIS BANK LTD', 'AXIS BANK'");
  if (p === 'kotak') customizedTemplate = customizedTemplate.replace("'KOTAK BANK'", "'KOTAK MAHINDRA BANK', 'KOTAK BANK'");
  if (p === 'bob') customizedTemplate = customizedTemplate.replace("'BOB BANK'", "'BANK OF BARODA', 'BOB'");
  if (p === 'pnb') customizedTemplate = customizedTemplate.replace("'PNB BANK'", "'PUNJAB NATIONAL BANK', 'PNB'");
  if (p === 'canara') customizedTemplate = customizedTemplate.replace("'CANARA BANK'", "'CANARA BANK'");
  if (p === 'unionbank') customizedTemplate = customizedTemplate.replace("'UNIONBANK BANK'", "'UNION BANK OF INDIA'");
  if (p === 'boi') customizedTemplate = customizedTemplate.replace("'BOI BANK'", "'BANK OF INDIA', 'BOI'");
  if (p === 'idfc') customizedTemplate = customizedTemplate.replace("'IDFC BANK'", "'IDFC FIRST BANK', 'IDFC BANK'");

          fs.writeFileSync(path.join(dir, p + '.js'), customizedTemplate.trim());
}

console.log('Setup complete: Generated 14 plugins + index router.');
