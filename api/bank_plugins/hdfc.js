/**
 * Bank Plugin: HDFC
 */

// More specific identifiers — 'HDFC BANK' alone is NOT listed because it appears
// in transaction descriptions on other banks' statements (e.g. Axis EMI to HDFC loan)
export const identifiers = ['HDFC BANK LTD', 'HDFC BANK LIMITED', 'HDFC BANK ACCOUNT STATEMENT'];

export function parser(docText) {
  const debits = [];
  // Split by newline and attempt generic fallback transaction match
  // A typical transaction line contains: Date, Description, Amount (with possible balance)
  const lines = docText.split('\n');
  const txRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([0-9,\.]+)\s+(?:(?:Cr|Dr|\s+)?([0-9,\.]+)?)?/i;

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