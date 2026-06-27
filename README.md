# Mirror — AI for Self-Inquiry

Mirror is a wellness application built on attachment science. It utilizes a **Two-Agent AI Architecture** powered by Google Gemini to help users understand their relationship dynamics and attachment styles:

* **Conscious Agent ("The Therapist")**: Warm, Socratic, and empathetic. Chats and reflects with the user, guiding them through daily self-inquiry.
* **Unconscious Agent ("The Mirror")**: Runs silently across the database of journals and chat history. Once a week, it surfaces one direct, evidence-based, and uncomfortable observation regarding avoidances, omissions, or naming shifts.

---

## Technical Stack

* **Frontend**: React, Vite, Tailwind CSS (configured in Minimalist Light Mode)
* **Backend**: FastAPI, Python 3.11, Uvicorn
* **Database**: Supabase
* **AI Engine**: Google Gemini API via the `google-genai` Python SDK

---

## Directory Structure

```
mirror/
├── frontend/               # React + Vite + Tailwind CSS App
│   ├── src/
│   │   ├── components/     # UI layouts (TabBar, User Switcher, etc.)
│   │   ├── App.jsx         # App state & Screen routing (Home, Journal, Chat, Mirror, Map)
│   │   └── index.css       # Tailwind imports & custom animations
│   ├── tailwind.config.js  # Color tokens (Warm base, Alabaster white, Charcoal text, Gold/Indigo accents)
│   └── postcss.config.js   # Tailwind v4 PostCSS configuration
├── backend/                # FastAPI Python Backend
│   ├── app/
│   │   ├── main.py         # App routers & CORS configurations
│   │   ├── db.py           # Supabase DB integrations with a local Mock fallback client
│   │   ├── ai.py           # Gemini API prompts (Therapist Chat, Tagging, Observations)
│   │   ├── config.py       # Pydantic environment configuration loader
│   │   └── models.py       # Request & response validation models
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment keys template
├── test_users.md           # 5 pre-configured local test profiles & UUIDs
└── README.md
```

---

## How to Run the Code

### 1. Setup Environment Credentials
The backend uses a local Mock fallback database and simulated AI responses out-of-the-box, but to connect live services:
* Open `backend/.env` (created for you with Supabase credentials).
* Replace `your-gemini-api-key` with your official Google Gemini API key:
  ```ini
  GEMINI_API_KEY=AIzaSy...
  ```

### 2. Start the Backend API (FastAPI)
Open a terminal in the `backend/` folder:
```bash
cd backend
python -m uvicorn app.main:app --reload
```
The backend will run on: `http://127.0.0.1:8000`

### 3. Start the Frontend Dev Server (React)
Open a separate terminal in the `frontend/` folder:
```bash
cd frontend
npm run dev
```
Navigate to the provided address (usually `http://localhost:5173`) in your web browser.

---

## Developer Multi-User Switcher

To test different attachment styles and logging boundaries:
1. Locate the **Developer Account Selector** dropdown in the header of the React app.
2. Select a profile (e.g. *Enkh*, *Alex*, *Taylor*, *Jordan*, *Morgan*).
3. The app will automatically isolate all journals, Socratic chat history, and attachment map coordinates to that user’s UUID.
4. Profiles and associated test IDs are detailed in [test_users.md](test_users.md).