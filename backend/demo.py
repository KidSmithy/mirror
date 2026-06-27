"""End-to-end demo of the Mirror user journey via FastAPI TestClient."""
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
H = {"x-user-id": "e1a8b9c8-1234-5678-abcd-ef0123456789"}


def line():
    print("=" * 64)


def post(path, payload):
    r = c.post(path, json=payload, headers=H)
    if r.status_code != 200:
        print(f"  !! {path} -> {r.status_code}: {r.text[:300]}")
        return None
    return r.json()


def get(path):
    r = c.get(path, headers=H)
    if r.status_code != 200:
        print(f"  !! {path} -> {r.status_code}: {r.text[:300]}")
        return None
    return r.json()


# 1. ONBOARDING
line()
print(" 1. ONBOARDING  — infer attachment style from scenario answers")
line()
answers = [
    "When they don't text back for hours I spiral and keep checking my phone.",
    "I replay the conversation looking for what I did wrong.",
    "I want constant reassurance that we're okay.",
    "I get scared they're losing interest the moment things go quiet.",
    "Sometimes I pull away first so I don't get hurt.",
]
a = post("/api/onboarding/assess", {"answers": answers})
if a:
    print(f"  Pattern   : {a['pattern_name']}")
    sec = f" · with some {a['secondary_style']}" if a.get('secondary_style') else ""
    print(f"  Style     : {a['primary_style']}{sec}")
    print(f"  Mirror    : \"{a['quote']}\"")
    print(f"  Says      : {a['description']}")
    print(f"  Triggers  : {', '.join(a.get('triggers', []))}")

# 2. JOURNALING
line()
print(" 2. JOURNALING  — entries get auto-tagged by Gemini")
line()
for e in [
    "Texted him twice and no reply. I keep refreshing.",
    "Felt calm today, we had a good talk and I trusted it.",
]:
    j = post("/api/journals", {"content": e})
    if j:
        print(f"  \"{e[:48]}\"")
        print(f"     tags -> {j.get('tags')}")

# 3. THERAPIST CHAT
line()
print(" 3. THERAPIST  — conscious, Socratic conversation")
line()
chat = post("/api/chats", {"message": "I feel anxious he hasn't replied all day."})
if chat:
    print(f"  me   : I feel anxious he hasn't replied all day.")
    print(f"  them : {chat['message']}")

# 4. THE MIRROR
line()
print(" 4. THE MIRROR  — unconscious pattern engine, weekly observations")
line()
obs = post("/api/observations/generate", {})
if obs:
    for o in obs[:3]:
        print(f"  [{o['category']}] \"{o['quote']}\"")
        print(f"     evidence: {o['evidence'][:80]}")

# 5. ATTACHMENT MAP
line()
print(" 5. ATTACHMENT MAP  — running tally of styles")
line()
m = get("/api/attachment-map")
if m:
    print(f"  anxious={m['anxious_count']}  avoidant={m['avoidant_count']}  secure={m['secure_count']}")

line()
print(" demo complete")
line()
