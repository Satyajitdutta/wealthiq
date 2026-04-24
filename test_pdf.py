import pypdf, json, urllib.request, ssl, time

filepath = 'C:/Users/Administrator/Downloads/XXXXXXXXXXXXXXX7242-01-04-2026to17-04-2026 (1).pdf'
reader = pypdf.PdfReader(filepath)
reader.decrypt('SATY847564085')
text = ''.join((p.extract_text() or '') + '\n' for p in reader.pages)
print(f'PDF text: {len(text)} chars')

payload = json.dumps({'docText': text, 'city': 'hyderabad'}).encode('utf-8')
ctx = ssl.create_default_context()

print('Polling Railway every 20s for up to 3 min...')
for attempt in range(9):
    time.sleep(20)
    try:
        req = urllib.request.Request(
            'https://wealthiq-production.up.railway.app/api/doc-extract',
            data=payload,
            headers={'Content-Type': 'application/json; charset=utf-8'},
            method='POST'
        )
        with urllib.request.urlopen(req, context=ctx, timeout=90) as r:
            resp = json.loads(r.read().decode())
            if resp.get('success'):
                ext = resp['extracted']
                print(f'\n=== SUCCESS (attempt {attempt+1}) ===')
                print('Doc type:', ext.get('doc_type'))
                print('Monthly inflow:', ext.get('monthly_inflow'))
                print('Monthly outflow:', ext.get('monthly_outflow'))
                print('Closing balance:', ext.get('closing_balance'))
                print('EMI total:', ext.get('emi_total'))
                rd = ext.get('recurring_debits', [])
                print(f'Recurring debits ({len(rd)}):')
                for item in rd:
                    print(f"  {item['name']}: Rs.{item['amount']} ({item.get('category','')})")
                break
            else:
                print(f'Attempt {attempt+1}: {resp.get("errorCode")} | {str(resp.get("error",""))[:120]}')
    except Exception as e:
        print(f'Attempt {attempt+1}: exception - {e}')
else:
    print('All attempts failed.')
