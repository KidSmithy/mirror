import logging
import json
import re
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger("mirror-ai")

# Check if Gemini key is set and valid
use_real_gemini = bool(settings.gemini_api_key and not settings.gemini_api_key.startswith("your-gemini"))

client = None
if use_real_gemini:
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        logger.info("Gemini Client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}. Falling back to Mock AI.")
        use_real_gemini = False

# Shared trauma-informed guardrail prepended to every specialist's system prompt.
_SAFETY_PREAMBLE = (
    "You are a supportive wellness companion, not a licensed clinician. Never diagnose, label, "
    "or claim to treat any condition; this is gentle self-inquiry, not therapy. If the user expresses "
    "thoughts of self-harm, suicide, or being in danger, set the reflective questions aside and gently, "
    "directly encourage them to reach out right now to a crisis line (in the US, call or text 988) or a "
    "trusted professional. Always prioritize the user's safety, choice, and pace; never pressure them to "
    "relive painful details."
)

# The Therapist's specialist personas, keyed by topic. Each is brief, warm, and ends with a reflective question.
_SPECIALIST_PROMPTS = {
    "general": (
        "You are The Therapist, a warm, Socratic, attachment-informed wellness companion. "
        "Guide the user through gentle self-inquiry based on attachment theory. "
        "Keep your responses relatively brief (1-3 sentences) and highly empathetic. "
        "Reflect back what you hear, and end with a gentle question that prompts deeper reflection."
    ),
    "anxiety": (
        "You are The Anxiety Specialist, a calm, grounding companion for worry, panic, and overthinking. "
        "Help the user slow racing thoughts, return to the present, and separate fear from fact. "
        "Keep responses brief (1-3 sentences), steadying and reassuring. End with a gentle, grounding question."
    ),
    "depression": (
        "You are The Mood Guide, a tender companion for low mood, lost motivation, and heaviness. "
        "Validate how hard things feel, never minimize, and look gently for small footholds of meaning or movement. "
        "Keep responses brief (1-3 sentences), warm and non-judgmental. End with a soft, low-pressure question."
    ),
    "trauma": (
        "You are The Trauma Specialist, trauma-informed and safety-first. Move slowly, emphasize the user's choice "
        "and control at every step, and help them feel grounded in the present rather than reliving the past. "
        "Keep responses brief (1-3 sentences), steady and gentle. End with an optional invitation, never a demand."
    ),
    "grief": (
        "You are The Grief Companion, here to sit with loss and bereavement without rushing toward closure. "
        "Make room for the full weight of grief and honor the relationship that was lost. "
        "Keep responses brief (1-3 sentences), gentle and unhurried. End with a soft, caring question."
    ),
    "stress": (
        "You are The Burnout Coach, focused on stress, overwhelm, and depletion. "
        "Help the user name what is draining them, find boundaries and recovery, and notice the cost of pushing through. "
        "Keep responses brief (1-3 sentences), practical and warm. End with a reflective question."
    ),
    "relationship": (
        "You are The Relationship Therapist, a Socratic specialist in relationship dynamics and attachment science. "
        "Help the user explore patterns of codependency, anxious reassurance-seeking, avoidant distancing, or secure boundary setting. "
        "Keep responses brief (1-3 sentences), warm, and focused on relationship dynamics. End with an insightful question."
    ),
    "mental": (
        "You are The Wellness Therapist, focusing on emotional regulation, self-compassion, and stress. "
        "Help the user name their emotions, locate physical tension in their body, and practice self-compassion. "
        "Keep responses brief (1-3 sentences), soothing, and grounding. End with a reflective Socratic question."
    ),
    "family": (
        "You are The Family Systems Therapist, exploring childhood structures and family patterns. "
        "Guide the user to trace their current emotional reactions back to early family dynamics, parental expectations, or childhood roles. "
        "Keep responses brief (1-3 sentences), compassionate, and analytical. End with a gentle question about family history."
    ),
}

# Mock replies per specialist, used when no Gemini key is configured.
_MOCK_SPECIALIST_REPLIES = {
    "anxiety": "Anxiety often races ahead of the facts. *What is the worry trying to warn you about right now?*",
    "depression": "That heaviness is real, and naming it takes strength. *What is one small thing that used to feel like yours?*",
    "trauma": "We can go as slowly as you need — you're in control here. *What would help you feel a little safer in this moment?*",
    "grief": "Grief is love with nowhere to go. *What do you most wish you could still say to them?*",
    "stress": "Carrying all of that would tire anyone out. *What is one thing that isn't actually yours to hold?*",
}


def generate_therapist_response(history: list, topic: str = "general") -> str:
    """
    Generates a warm, Socratic, attachment-informed response.
    History is a list of dicts: [{'sender': 'me'/'them', 'message': '...'}]
    """
    if not use_real_gemini:
        if not history:
            return "What's on your mind?"
        last_msg = history[-1]['message'].lower()

        # Lightweight crisis catch mirrors the safety preamble's intent in the mock path.
        if any(w in last_msg for w in ["suicide", "kill myself", "end my life", "hurt myself", "self-harm"]):
            return ("I'm really glad you told me, and I want you to be safe. *Please reach out right now — "
                    "in the US you can call or text 988 to talk with someone who can help.*")

        if topic in _MOCK_SPECIALIST_REPLIES:
            return _MOCK_SPECIALIST_REPLIES[topic]

        if topic == "relationship":
            if "avoid" in last_msg or "distance" in last_msg:
                return "Distancing can feel like safety when intimacy feels overwhelming. *What did you fear would happen if you stayed close?*"
            if "anxious" in last_msg or "worry" in last_msg:
                return "The anxiety is trying to protect the connection. *What does the urge to reach out tell you about your core needs?*"
            return "Relationships act as mirrors for our oldest patterns. *Where does this particular response style feel familiar?*"
            
        elif topic == "mental":
            if "anxious" in last_msg or "stressed" in last_msg or "tired" in last_msg:
                return "I hear the stress in your words. *Where in your body do you feel this weight holding on right now?*"
            return "Naming what is true in the body is the first step of release. *If that feeling had a voice, what would it be saying?*"
            
        elif topic == "family":
            if "mother" in last_msg or "father" in last_msg or "parents" in last_msg:
                return "Our parents write the first scripts for how we love. *What script did you feel you had to follow?*"
            return "Childhood survival strategies often become adult blockages. *How did this strategy serve you when you were younger?*"
            
        else: # general
            if "online" in last_msg or "checking" in last_msg:
                return "The checking is interesting. *What feels worse — that he's not replying, or that you're the one watching?*"
            if "tired" in last_msg:
                return "Exhaustion often carries a weight. *Is it the day's tasks that feel heavy, or the silence you're holding?*"
            if "small" in last_msg:
                return "Feeling small can sometimes protect us from taking up too much room. *Who in your life makes you feel like you need to shrink?*"
            return "I hear how much weight that carries for you. *What is the underlying fear if you let go of trying to manage this?*"

    try:
        # Build chat transcript
        chat_transcript = ""
        for h in history:
            speaker = "User" if h['sender'] == 'me' else "Therapist"
            chat_transcript += f"{speaker}: {h['message']}\n"
        
        system_instruction = _SAFETY_PREAMBLE + " " + _SPECIALIST_PROMPTS.get(topic, _SPECIALIST_PROMPTS["general"])

        prompt = f"""
        Below is the chat history between the User and The Therapist.
        Generate the next Therapist response following your core instructions.
        
        Chat History:
        {chat_transcript}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini API error during therapist chat: {e}")
        return "I hear you, and it makes sense why that would feel heavy. *What do you think is trying to be protected in this moment?*"

def generate_journal_tags(content: str) -> list:
    """
    Analyzes journal text and returns 2-3 attachment-related hashtags.
    """
    if not use_real_gemini:
        # Simulated auto-tagging
        content_lower = content.lower()
        tags = []
        if any(w in content_lower for w in ["check", "last seen", "reply", "online", "phone"]):
            tags.append("#checking-behavior")
            tags.append("#anxious-spiral")
        if any(w in content_lower for w in ["mother", "mom", "father", "dad"]):
            tags.append("#family-distance")
        if any(w in content_lower for w in ["avoid", "run", "silent", "quiet"]):
            tags.append("#avoidant-defense")
        if not tags:
            tags.append("#reflection")
            tags.append("#daily-entry")
        # Ensure we always append auto-tagged indicator
        tags.append("— auto-tagged")
        return tags

    try:
        prompt = f"""
        Analyze the following journal entry text and extract exactly 2 relevant psychological hashtags representing attachment patterns, defense mechanisms, or core emotional themes (e.g. #anxious-spiral, #avoidance, #core-fear, #reassurance-seeking, #family-distance, #boundary-setting).
        
        Format your response as a JSON array of strings containing ONLY the hashtags.
        Example output: ["#anxious-spiral", "#family-distance"]

        Journal entry:
        "{content}"
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )
        tags = json.loads(response.text.strip())
        if isinstance(tags, list):
            # Clean and add auto-tagged flag
            cleaned_tags = [t if t.startswith("#") else f"#{t}" for t in tags[:2]]
            cleaned_tags.append("— auto-tagged")
            return cleaned_tags
        return ["#reflection", "— auto-tagged"]
    except Exception as e:
        logger.error(f"Gemini API error during tag generation: {e}")
        return ["#reflection", "— auto-tagged"]

def generate_weekly_observations(journals: list, chats: list) -> list:
    """
    The Unconscious Agent (The Mirror).
    Analyzes all user text (journals + chats) to extract uncomfortable, evidence-based patterns.
    Returns a list of dicts matching ObservationResponse.
    """
    if not journals and not chats:
        return []

    # Compile user text history
    history_text = "--- USER JOURNAL ENTRIES ---\n"
    for idx, j in enumerate(journals):
        date_str = j.get('created_at', 'Unknown Date')
        history_text += f"Journal #{idx+1} ({date_str}): {j.get('content')}\n"

    history_text += "\n--- USER CHAT MESSAGES WITH THERAPIST ---\n"
    for idx, c in enumerate(chats):
        if c.get('sender') == 'me':
            date_str = c.get('created_at', 'Unknown Date')
            history_text += f"Message #{idx+1} ({date_str}): {c.get('message')}\n"

    if not use_real_gemini:
        # Fallback to smart generated mock observations if no API key is provided
        # We search user history for matching keywords
        all_text = (history_text).lower()
        obs = []
        if "mother" in all_text or "mom" in all_text:
            obs.append({
                "category": "distance",
                "quote": "You've written about your mother multiple times recently, but you never call her 'mom'. You always refer to her as 'my mother'. What does that distance protect?",
                "evidence": "Observed in your recent journal entries. The formal phrasing creates an emotional shield."
            })
        if "check" in all_text or "last" in all_text or "online" in all_text:
            obs.append({
                "category": "checking",
                "quote": "You repeatedly document checking if he is online, always followed by immediate self-blame like 'it's stupid'. Notice what shape that is: reach, retract, repair.",
                "evidence": "7 entries containing 'checking' behaviors followed by self-deprecating remarks."
            })
        if not obs:
            obs.append({
                "category": "avoidance",
                "quote": "You write a lot about daily tasks and distraction, but you completely omit discussing how you felt after your relationship ended. What are you keeping busy to avoid?",
                "evidence": "0 mentions of emotional states in 5 entries since June 15, despite the high frequency of task logging."
            })
        return obs[:2]

    try:
        system_instruction = (
            "You are The Mirror, the unconscious layer of the self. Your job is to analyze the user's journals and chat history to surface ONE or TWO weekly, uncomfortable, but deeply evidence-based observations that they keep avoiding. "
            "Analyze linguistic omissions (what/who is NOT said), avoided topics, shifts in naming, repeated avoidances, checking behaviors, self-soothing loops, and immediate retractions. "
            "Your output must be objective, direct, compassionate but unflinchingly honest, and backed up with evidence."
        )

        prompt = f"""
        Below is the user's complete writing history. Generate exactly 2 weekly observations in a JSON list structure:
        [
          {{
            "category": "String (e.g. 'distance', 'checking', 'omission')",
            "quote": "String (A direct, slightly uncomfortable, Socratic quote addressed to the user. Start with 'You...', e.g. 'You've written about your mother 14 times this month, but always refer to her as \"my mother\" instead of \"mom\". What does that distance protect?')",
            "evidence": "String (A concise summary of database logs, mentioning counts, dates, or specific naming shifts, e.g. '14 mentions across journal entries from June 3-25. The naming shift occurred after March 14.')"
          }}
        ]

        Do not wrap in markdown boxes; output raw JSON only.

        User History:
        {history_text}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.3,
            )
        )
        
        # Parse JSON list
        raw_json = response.text.strip()
        # Clean up any potential markdown wraps
        if raw_json.startswith("```"):
            raw_json = re.sub(r"^```json\s*", "", raw_json)
            raw_json = re.sub(r"\s*```$", "", raw_json)
        
        observations = json.loads(raw_json)
        if isinstance(observations, list):
            return observations
        return []
    except Exception as e:
        logger.error(f"Gemini API error during Mirror observation generation: {e}")
        return []

# Mock copy keyed by style, used when no Gemini key is configured.
_MOCK_STYLE_PROFILES = {
    "Anxious": {
        "pattern_name": "The Pursuer-Protester",
        "description": "You stay close. You over-tend. You're often the one who notices the silence before anyone else does.",
        "quote": "\"You used the word 'almost' more than once. We can come back to that.\"",
        "triggers": ["unanswered messages", "perceived withdrawal", "ambiguous tone"],
    },
    "Avoidant": {
        "pattern_name": "The Quiet Withdrawer",
        "description": "You keep your distance. You self-soothe. You're often the one who notices the pressure before anyone else does.",
        "quote": "\"You reached for 'space' and 'tired' more than once. Protection has many shapes.\"",
        "triggers": ["sudden closeness", "feeling managed", "high expectations"],
    },
    "Secure": {
        "pattern_name": "The Steady Anchor",
        "description": "You balance closeness and autonomy. You communicate clearly. You feel grounded in relationships.",
        "quote": "\"A steady pulse. There is room in your stories for both yourself and the other.\"",
        "triggers": ["prolonged conflict", "dishonesty", "unmet agreements"],
    },
    "Disorganized": {
        "pattern_name": "The Push-Pull",
        "description": "You want closeness and you fear it at once. You reach, then retract — the rhythm can feel exhausting from the inside.",
        "quote": "\"You move toward and away in the same breath. That isn't failure; it's a learned safety.\"",
        "triggers": ["intimacy after distance", "raised voices", "unpredictability"],
    },
}

def assess_attachment_style(answers: list) -> dict:
    """
    Onboarding assessor. Infers attachment style from free-text scenario answers.
    Returns a dict matching AssessmentResponse.
    """
    answers_text = "\n".join(f"Q{i+1}: {a}" for i, a in enumerate(answers) if a and a.strip())

    if not use_real_gemini:
        text = answers_text.lower()
        scores = {"Anxious": 0, "Avoidant": 0, "Secure": 0}
        keywords = {
            "Anxious": ["almost", "check", "waiting", "reply", "anxious", "worry",
                        "need", "silence", "notice", "close", "overthink", "reassur"],
            "Avoidant": ["distance", "space", "alone", "tired", "put the phone down",
                         "myself", "independent", "withdraw", "busy", "shut down", "pull away"],
            "Secure": ["talk", "communicate", "calm", "okay", "understand",
                       "comfortable", "trust", "honest"],
        }
        for style, kws in keywords.items():
            for kw in kws:
                if kw in text:
                    scores[style] += 1

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary = ranked[0][0] if ranked[0][1] > 0 else "Anxious"
        # Anxious + Avoidant both strongly present AND dominant => disorganized (push-pull)
        if (scores["Anxious"] > 0 and scores["Avoidant"] > 0
                and abs(scores["Anxious"] - scores["Avoidant"]) <= 1
                and min(scores["Anxious"], scores["Avoidant"]) >= scores["Secure"]):
            primary = "Disorganized"
        secondary = ranked[1][0] if ranked[1][1] > 0 and ranked[1][0] != primary else None

        profile = _MOCK_STYLE_PROFILES[primary]
        return {
            "primary_style": primary,
            "secondary_style": secondary,
            **profile,
        }

    try:
        system_instruction = (
            "You are the onboarding assessor for Mirror, an attachment-style companion. "
            "Given a user's free-text answers to scenario questions, infer their attachment style. "
            "Be warm, specific, and ground your read in their actual words. Never diagnose; this is self-inquiry."
        )
        prompt = f"""
        Analyze these onboarding answers and classify the user's attachment style.

        {answers_text}

        Return raw JSON only (no markdown fences):
        {{
          "primary_style": "Anxious | Avoidant | Secure | Disorganized",
          "secondary_style": "one of the above, or null",
          "pattern_name": "a short, evocative handle, e.g. 'The Pursuer-Protester'",
          "description": "2-3 sentences in second person ('You...'), warm and specific",
          "quote": "a single short 'note from the Mirror' that references their own words",
          "triggers": ["3 short trigger phrases inferred from their answers"]
        }}
        """
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.4,
            )
        )
        raw_json = response.text.strip()
        if raw_json.startswith("```"):
            raw_json = re.sub(r"^```json\s*", "", raw_json)
            raw_json = re.sub(r"\s*```$", "", raw_json)
        result = json.loads(raw_json)
        result.setdefault("secondary_style", None)
        result.setdefault("triggers", [])
        return result
    except Exception as e:
        logger.error(f"Gemini API error during attachment assessment: {e}")
        return {"primary_style": "Anxious", "secondary_style": None, **_MOCK_STYLE_PROFILES["Anxious"]}
