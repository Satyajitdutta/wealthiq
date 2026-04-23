// Test script: replicates browser PDF text extraction + API call
// Uses pdfjs-dist (same library as the browser)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const API_URL = 'https://wealth.pithonix.ai/api/doc-extract';

const FILES = [
  { path: 'C:\\Users\\Administrator\\Downloads\\592641_JAN2026_Salary Slip.pdf',  label: 'Salary Slip',     idx: 1 },
  { path: 'C:\\Users\\Administrator\\Downloads\\Chuwi Laptop_copy\\Bank_statement.pdf', label: 'Bank Statement',   idx: 2 },
];

async function extractText(pdfBuffer) {
  // Use PDF.js in Node (same lib the browser uses)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null)
                || await import('pdfjs-dist').catch(() => null);

  if (!pdfjsLib) throw new Error('pdfjs-dist not installed. Run: npm install pdfjs-dist');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;

  let fullText = `TOTAL PAGES: ${pdf.numPages}\n\n`;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push(item.str);
    }
    const pageText = Object.keys(lines)
      .sort((a, b) => b - a)
      .map(y => lines[y].join('  '))
      .filter(l => l.trim())
      .join('\n');
    fullText += `--- PAGE ${p} ---\n${pageText}\n\n`;
  }
  return { text: fullText, pages: pdf.numPages };
}

async function testFile({ path, label, idx }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log(`File: ${path}`);

  const buf = readFileSync(path);
  console.log(`File size: ${Math.round(buf.length / 1024)} KB`);

  // Try text extraction
  let docText;
  try {
    const { text, pages } = await extractText(buf);
    const meaningful = text.replace(/[\s\-\|]+/g, '').length;
    console.log(`PDF.js extracted: ${pages} pages, ${meaningful} meaningful chars`);

    if (meaningful > 800) {
      docText = text;
      console.log(`Mode: TEXT (first 500 chars preview):`);
      console.log(text.slice(0, 500));
    } else {
      console.log(`Mode: Sparse text (${meaningful} chars) — would fall back to image`);
      console.log(`First 200 chars: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`PDF extraction ERROR: ${err.name}: ${err.message}`);
    return;
  }

  if (!docText) {
    console.log('SKIPPING API call — would need image fallback (not tested here)');
    return;
  }

  // POST to API
  console.log(`\nPosting to API...`);
  const body = JSON.stringify({ docText, city: 'hyderabad' });
  console.log(`Payload size: ${Math.round(body.length / 1024)} KB`);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(45000),
    });
    const json = await res.json();
    console.log(`API Status: ${res.status}`);
    if (json.success) {
      console.log(`SUCCESS! Extracted fields:`);
      console.log(JSON.stringify(json.extracted, null, 2));
    } else {
      console.log(`API returned failure:`, JSON.stringify(json, null, 2));
    }
  } catch (err) {
    console.error(`API call ERROR: ${err.message}`);
  }
}

for (const f of FILES) {
  await testFile(f);
}
