import pypdf, json, urllib.request, urllib.error, ssl, time, sys

RAILWAY = 'https://wealthiq-production.up.railway.app'
filepath = 'C:/Users/Administrator/Downloads/XXXXXXXXXXXXXXX7242-01-04-2026to17-04-2026 (1).pdf'
ctx = ssl.create_default_context()

# ── 1. Health check ──────────────────────────────────────────────────
print('=== 1. Health check ===')
try:
    req = urllib.request.Request(RAILWAY + '/', method='GET')
    with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
        print(f'Status: {r.status}  (Railway is UP)')
except Exception as e:
    print(f'Health check failed: {e}')

# ── 2. Extract PDF text ──────────────────────────────────────────────
print('\n=== 2. Extracting PDF text ===')
reader = pypdf.PdfReader(filepath)
reader.decrypt('SATY847564085')
text = ''.join((p.extract_text() or '') + '\n' for p in reader.pages)
print(f'PDF chars: {len(text)}')

# ── 3. Hit API immediately (no wait, new deployment should be live) ──
print('\n=== 3. Calling /api/doc-extract directly on Railway ===')
payload = json.dumps({'docText': text, 'city': 'hyderabad'}).encode('utf-8')

for attempt in range(1, 4):
    print(f'Attempt {attempt}...')
    try:
        req = urllib.request.Request(
            RAILWAY + '/api/doc-extract',
            data=payload,
            headers={'Content-Type': 'application/json; charset=utf-8'},
            method='POST'
        )
        with urllib.request.urlopen(req, context=ctx, timeout=120) as r:
            resp = json.loads(r.read().decode())
            if resp.get('success'):
                ext = resp['extracted']
                print(f'✅ SUCCESS on attempt {attempt}')
                print(f"   model used: gemini-2.0-flash (new)")
                print(f"   doc_type: {ext.get('doc_type')}")
                print(f"   confidence: {ext.get('confidence')}")
                print(f"   monthly_inflow: {ext.get('monthly_inflow')}")
                print(f"   monthly_outflow: {ext.get('monthly_outflow')}")
                print(f"   closing_balance: {ext.get('closing_balance')}")
                print(f"   emi_total: {ext.get('emi_total')}")
                sys.exit(0)
            else:
                err = resp.get('error', '')
                code = resp.get('errorCode', '')
                print(f'❌ API error: [{code}] {err}')
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        print(f'  HTTP {e.code}: {body}')
    except Exception as e:
        print(f'  Exception: {e}')
    
    if attempt < 3:
        print('  waiting 5s before retry...')
        time.sleep(5)

print('\nAll attempts failed. Railway may still be deploying — wait 2 min and try upload in browser.')
