import json, urllib.request, ssl

# got-advice uses gemini-2.5-flash and it works.
# The issue was responseMimeType: 'application/json' breaking thinking mode.
# Let's test gemini-2.5-flash WITHOUT responseMimeType via Railway
# by setting a special test flag... actually let's just fix the code.

# First let's confirm: what does got-advice.js actually use?
# It uses gemini-2.5-flash at /v1beta/models/gemini-2.5-flash:generateContent
# And it does NOT use responseMimeType.

# Let's verify gemini-2.5-flash works by calling the Railway got-advice endpoint
payload = json.dumps({
    "profile": {
        "name": "Test",
        "age": 30,
        "monthly_income": 100000,
        "monthly_expenses": 50000,
        "city": "hyderabad",
        "risk": "moderate",
        "goals": ["emergency_fund"]
    }
}).encode('utf-8')

ctx = ssl.create_default_context()
req = urllib.request.Request(
    'https://wealthiq-production.up.railway.app/api/got-advice',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        resp = json.loads(r.read().decode())
        print('got-advice success:', resp.get('success', 'unknown'))
        print('Has advice:', bool(resp.get('advice') or resp.get('report')))
except Exception as e:
    print(f'Error: {e}')
