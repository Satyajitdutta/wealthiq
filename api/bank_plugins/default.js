/**
 * Bank Plugin: Default Fallback
 */

export const identifiers = [];

export function parser(docText) {
  const debits = [];
  const lines = docText.split('\n');
  
  // Very generic pattern looking for dates at start of string
  // Format: DD-MM-YYYY or DD.MM.YY followed by description and amounts
  const txRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([0-9,\.]+)(?=\s|$)/i;

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