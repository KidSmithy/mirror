# Mirror — Design Doc

> A companion that knows your attachment patterns better than you do, and uses
> that to reflect you back to yourself.

**AI Engine Migration:** Google Gemini AI -> OpenAI
**Sources:** Notion — *Attachment Styles* and *2026-05-31 Session*; current `mirror` repo

---

## Judging Criteria (and how Mirror hits each)

1. **AI Engine** — Powered by OpenAI (`gpt-4o-mini`, `gpt-image-2` for images, `tts-1` for audio).
2. **Innovation** — The two-agent conscious/unconscious split + multimodal voice journaling and DALL-E 3 attachment maps.
3. **Completeness** — does it work? Is it demo-ready?
   → End-to-end flow already runs; scripted 3-min demo in §11.
4. **Deployed project** — submit a deployed app/website link.
   → Deployment plan in §12.

---

## 1. Problem & Thesis

Attachment theory is mainstream vocabulary now ("anxious-avoidant," Thais Gibson,
Heidi Priebe), but no app operates on the attachment frame day-to-day:

- **Calm / Headspace** — state-based ("calm me now"), not pattern-based.
- **BetterHelp** — therapist-mediated, expensive, async.
- **Replika / Wysa** — generic chat, parasocial, low legitimacy.
- **Lasting / Paired** — static curricula, no personalization.

**The wedge:** a companion that *learns your attachment patterns over time* and
reflects them back. The defensibility is not the chatbot — anyone can build that.
It's the longitudinal pattern engine plus the behavioral memory it accumulates.

## 2. Goals & Non-Goals

**Goals**
- Two-layer AI (conscious therapist + unconscious pattern engine) that feels
  uncannily perceptive without feeling like surveillance.
- Demo-ready in a **3-minute** demo: seed history → run a Mirror Session → reveal.
- Real Google Cloud integration (judging requirement — missing it disqualifies).
- **A live deployed link** (Cloud Run / agent runtime) — required for submission.
- Privacy as a visible brand pillar, not a footer link.

**Non-Goals (for hackathon v1)**
- Couples / dyadic mode (designed-for, not built).
- Romantic avatar or persona framing (explicitly avoided — kills legitimacy).
- Clinical diagnosis claims (regulatory trap — frame as "self-inquiry").
- Real voice transcription (UI stub only for now).

## 3. Target Users & Personas

Frustrated in intimate relationships, 20s–30s. From Notion:

1. **Woman (20s) + manipulative partner (30s)** — she doesn't understand the dynamic.
2. **Couple since college, now ~27, living together** — drifting apart.
3. **Mismatched-worlds couple (20s)** — different class/family backgrounds.

**Recommended acquisition wedge: breakup recovery.** Peak-pain moment, the most
motivated wellness buyers on earth, naturally viral, and a clean funnel:
*earn secure → dating-ready → couples mode.*

## 4. Product Architecture — The Two Layers

### Conscious layer — "The Therapist"
The presence you talk to. Warm-but-direct (not sycophantic). Short-term session
memory. Reflects, reframes, asks Socratic questions. Two intended modes:
- **Co-regulation** — when the user is spiking. Short, somatic, here-now.
- **Reflection** — for processing. Longer, exploratory.

Crisis detection routes out to human resources (988 / Samaritans), hard-coded.

### Unconscious layer — "The Mirror"
The pattern engine the user does *not* talk to directly. Runs continuously over
all journals, chats, and mood logs. Two outputs:

1. **Priming the conscious layer.** Before the Therapist responds, the Mirror
   feeds a primer ("anxious activation, 3rd time this week, likely trigger =
   unread message Tuesday"). This is why the Therapist feels perceptive vs. a
   generic chatbot.
2. **Direct surfacing.** Gentle, scheduled "I've been noticing…" cards (max 2–3
   per week) and a weekly depth report. Each insight has a **"this doesn't land"**
   control — the user's pushback becomes training signal.

> Example surfacing: *"You've written about your mother 14 times this month, but
> always 'my mother,' never 'mom.' What does that distance protect?"* — the teeth
> come from the user's own data, so it can't be wrong, only confronting.

## 5. System Architecture

### Current implementation (in repo)
```
React + Vite + Tailwind  ──HTTP──►  FastAPI  ──►  Supabase (Postgres)
   (mobile-framed UI)                  │
                                       └──►  gpt-4o-mini (openai SDK)
```
- **Frontend:** `frontend/src/App.jsx` — 8 screens (Welcome, Onboard, Reveal,
  Home, Journal, Chat, Mirror, Map; Mirror has intro/observation/integration
  sub-screens), dev user switcher, animated attachment map. Talks to
  `http://127.0.0.1:8000/api`.
- **Backend:** `backend/app/main.py` — REST API; `ai.py` holds both agents with
  mock fallbacks when no OpenAI key is set; `db.py` is the Supabase client.
- **AI:** gpt-4o-mini for Therapist responses, journal auto-tagging, and the
  weekly Mirror observations.

### Target architecture (Google Cloud alignment)
The judging criteria **require** Google Cloud, and the Notion vision names Vertex
AI + Firestore. The migration path:

| Concern            | Current            | Target (OpenAI Migration)                  |
|--------------------|--------------------|-------------------------------------------|
| LLM                | OpenAI API key     | **OpenAI** (`gpt-4o-mini`)                |
| Multi-agent orchestration | manual in `ai.py` | OpenAI chat completion system prompts   |
| Database           | Supabase Postgres  | Supabase Postgres                         |
| Pattern retrieval  | full-history dump  | Vector Search/Embeddings (future)         |
| Voice journaling   | UI stub            | **OpenAI TTS/STT**                        |
| Monthly map image  | CSS dots           | **DALL-E 3 (gpt-image-2)** generated map |

## 6. Data Model (current)

From `backend/app/models.py`:

- **journals** — `id, user_id, created_at, content, tags[], voice_duration`
- **chats** — `id, user_id, created_at, sender ('me'|'them'), message`
- **observations** — `id, user_id, week_num, category, quote, evidence, feedback, updated_at`
  - feedback ∈ `{lands, not_yet, say_more}`
- **attachment_map** — `user_id, date, anxious_count, avoidant_count, secure_count`

Five seeded test users (Enkh/anxious, Alex/avoidant, Taylor/secure,
Jordan/disorganized, Morgan/anxious) — see `test_users.md`.

## 7. Key User Flows

**Onboarding (~5 min, functional):** `welcome → onboard → reveal`. The `onboard`
screen steps through 5 scenario questions (`ONBOARD_QUESTIONS` in `App.jsx`),
collects free-text answers, and POSTs them to `/api/onboarding/assess`. The
**assessor agent** (`assess_attachment_style` in `ai.py`, OpenAI + mock fallback)
infers primary + secondary style, a *named* pattern ("The Pursuer-Protester" —
the shareable handle), a warm description, a "note from the Mirror" quote, and
inferred triggers. `reveal` renders the inferred result (falls back to the
pre-set test-user pattern if assessment is unavailable). *Backend verified via
TestClient; frontend not yet run (no Node locally).*

**Daily:** journal (text/voice) or chat with the Therapist. Every entry flows
through the unconscious pipeline. Implemented: `POST /api/journals`,
`POST /api/chats`.

**Weekly Mirror Session:** `POST /api/observations/generate` analyzes all
journals + chats and returns 1–3 evidence-backed observations; user marks each
lands / not yet / say more.

**Monthly Map:** evolving attachment landscape, shareable (growth loop).

## 8. The Mirror Pipeline (detail)

`generate_weekly_observations()` in `backend/app/ai.py`:
1. Compile user's full journal + chat history into a single transcript.
2. Prompt OpenAI as *The Mirror* — analyze linguistic omissions (what/who is
   NOT said), avoided topics, naming shifts, checking behaviors, self-soothing
   loops, immediate retractions.
3. Return JSON `[{category, quote, evidence}]`, persisted to `observations`.

**Target hardening:** replace the full-history dump with Vector Search retrieval
(embeddings per entry) so the pipeline scales past a demo and supports the
"90-day behavioral memory graph" moat.

## 9. Moat (ranked)

1. **Behavioral memory graph** — every entry makes the Mirror sharper for that
   user; switching cost compounds quietly.
2. **Attachment-specific scaffolding** — classifiers for the 4 styles, protest
   behavior, (de)activation, rupture/repair language, grounded in the literature
   (Mikulincer & Shaver, Levine, Gibson, Heller). Not a fine-tune — structured IP.
3. **Dyadic data (couples mode)** — cross-partner patterns; highest LTV.
4. **Trust as compound interest** — privacy must be visibly sacred.
5. **State-routed content** — exercises assigned by the engine, not a generic curriculum.

*Not a moat:* the Therapist chat alone.

## 10. Risks & Safety

- **Surfacings must feel like insight, not surveillance** — if the first one
  lands wrong, churn is brutal. Tone is everything; dedicate a writer to the copy.
- **"AI therapist" framing is a regulatory trap** — position as "AI for
  self-inquiry" / "attachment coach." No diagnosis claims.
- **Crisis path is hard-coded**, not model-discretionary.
- **Don't be Replika** — the Therapist is a presence, not a person.
- **Privacy is the brand** — on-device where possible, no training on user data,
  encrypted, deletable. "The diary that reads you back."

## 11. Demo Plan (3 minutes)

Suggested beats:
- **0:00–0:30 — Hook.** The problem + the one-liner ("the diary that reads you
  back"). Name the two-layer mechanism.
- **0:30–2:15 — Product demo.** Select a seeded user (e.g. Enkh, anxious) → show
  journal + Therapist chat → hit **Awaken the Mirror** → reveal the
  "my mother / never mom" observation *with receipts* → show the evolving
  attachment map. **Same input → two radically different outputs** is the
  jaw-drop. Call out Vertex AI / Managed Agents / multimodal as they appear.
- **2:15–2:45 — Why it wins.** Moat in one line (behavioral memory graph) + the
  live deployed link on screen.
- **2:45–3:00 — Close / Q&A buffer.**

Pre-seed a 30-day journal so the Mirror has real material to surface.

## 12. Deployment (required for submission)

Submission requires a **live link via Cloud Run / agent runtime.** Plan:

- **Backend (FastAPI):** containerize and deploy to **Cloud Run** in
  `still-tensor-482713-e9`. Auth to Vertex AI via the Cloud Run service account
  (no API keys in prod). Set CORS to the deployed frontend origin (not `*`).
- **Frontend (Vite/React):** build static assets; serve via **Cloud Run** (or
  Firebase Hosting) and point `API_BASE` at the deployed backend URL (currently
  hardcoded to `http://127.0.0.1:8000/api` in `App.jsx:11`).
- **Agents:** if using **Vertex AI Managed Agents / Agent Engine**, deploy the
  orchestration there and have the backend call it — this directly satisfies both
  the "Use of Google Cloud" and the "agent runtime" deployment criteria.
- **Data:** Firestore is fully managed (no deploy step); if staying on Supabase
  for the hackathon, ensure it's reachable from Cloud Run.

**Smallest path to a green checkmark:** Dockerize backend → `gcloud run deploy`
→ deploy frontend → submit the frontend URL.

## 13. Status & Next Steps

**Built:** full REST API, both agents (with mock fallbacks), 8-screen React UI
(incl. welcome/onboard/reveal + Mirror sub-screens), attachment map, Mirror
Session flow, feedback loop, 5 test personas. Backend targets Python 3.11.

**Gaps / next — ordered by hackathon priority:**

*Must-have (criteria-blocking):*
- [x] Create `backend/.env` (Supabase + OpenAI creds) — backend won't boot without it.
- [x] Migrate Gemini API → **OpenAI** (real API integration).
- [ ] **Deploy to Cloud Run** and submit the live link. See §12.
- [ ] Point frontend `API_BASE` at the deployed backend (`App.jsx:11`).

*High-value (innovation / completeness):*
- [ ] Vertex AI **Managed Agents** for the two-agent orchestration (criterion 2 bonus).
- [ ] Multimodal: real voice journaling + **DALL-E 3** monthly map.
- [x] Onboarding classifies attachment style from answers via `/api/onboarding/assess` (OpenAI + mock fallback; backend verified, frontend unrun — no Node locally).
- [ ] Pre-seed a 30-day journal for the demo.

*Polish / bugs:*
- [ ] Dynamic `week_num` (hardcoded to 12 in `main.py:183`).
- [ ] Fix missing `logger` import in `main.py:262`.

**Team (from Notion):** Conscious layer — Luyi / Mau. Unconscious layer — Enkh / Arnold.
