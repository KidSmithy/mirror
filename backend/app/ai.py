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

def generate_therapist_response(history: list) -> str:
    """
    Generates a warm, Socratic, attachment-informed response.
    History is a list of dicts: [{'sender': 'me'/'them', 'message': '...'}]
    """
    if not use_real_gemini:
        # High quality local mock responses based on final user message
        if not history:
            return "What's on your mind tonight?"
        last_msg = history[-1]['message'].lower()
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
        
        system_instruction = (
            "You are The Therapist, a warm, Socratic, attachment-informed wellness companion. "
            "Guide the user through gentle self-inquiry based on attachment theory. "
            "Keep your responses relatively brief (1-3 sentences) and highly empathetic. "
            "Reflect back what you hear, and end with a gentle question that prompts deeper reflection."
        )

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


def generate_mirror_reflection_update(user_message: str, current_reflection: str, current_ideal: str, attachment_style: str) -> dict:
    """
    Generates an updated reflection, ideal self reflection, and insight based on user's direct conversation with the mirror.
    """
    if not use_real_gemini:
        # Smart dynamic naming based on message keywords in mock mode
        msg_lower = user_message.lower()
        if any(w in msg_lower for w in ["mother", "father", "parent", "family"]):
            derived_style = "Generational Healing"
        elif any(w in msg_lower for w in ["boundary", "no", "stop", "limit"]):
            derived_style = "Boundary Attuning"
        elif any(w in msg_lower for w in ["calm", "safe", "breath", "still", "ground"]):
            derived_style = "Securely Grounded"
        elif any(w in msg_lower for w in ["anxious", "scared", "fear", "panic", "worry"]):
            derived_style = "Anxious-leaning (courageous)"
        elif any(w in msg_lower for w in ["space", "distance", "independent", "alone"]):
            derived_style = "Avoidant (softening)"
        else:
            derived_style = "Self-Attuning"

        return {
            "overall_reflection": f"Your mirror reflection has adjusted: {current_reflection} (Attuned to: '{user_message}')",
            "ideal_reflection": f"Your ideal self has evolved: {current_ideal} (Now centering on: '{user_message}')",
            "attachment_style": derived_style,
            "insight": f"Direct attunement: {user_message[:30]}..."
        }

    try:
        prompt = f"""
        You are the Looking Glass, a mirror of the user's psyche and attachment style.
        The user is talking directly to their mirror reflection.
        
        Current Reflection of the User:
        "{current_reflection}"
        
        Current Ideal Reflection (Vision of growth/security):
        "{current_ideal}"
        
        User's Attachment Style:
        {attachment_style}
        
        User's Message to the Mirror:
        "{user_message}"
        
        Task:
        1. Formulate an updated Overall Reflection that incorporates their new insight/message, showing how their current self-pattern is shifting.
        2. Formulate an updated Ideal Self Reflection that reflects a secure, integrated state aligned with their aspirations in their message.
        3. Formulate a 1-sentence Timeline Insight summarizing this moment of interaction.
        4. Generate a nuanced, poetic, and growth-oriented attachment style or psychological state name (e.g., 'Anxious-leaning (healing)', 'Grounded Boundary-Setter', 'Generational Healing', 'Avoidant (opening)', 'Securely Integrated') that reflects their current state of growth, healing, or progress as indicated by their message.
        
        Return your response in JSON format matching this schema:
        {{
            "overall_reflection": "string",
            "ideal_reflection": "string",
            "attachment_style": "string",
            "insight": "string"
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "overall_reflection": types.Schema(type=types.Type.STRING),
                        "ideal_reflection": types.Schema(type=types.Type.STRING),
                        "attachment_style": types.Schema(type=types.Type.STRING),
                        "insight": types.Schema(type=types.Type.STRING),
                    },
                    required=["overall_reflection", "ideal_reflection", "attachment_style", "insight"]
                )
            )
        )
        
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Failed to generate mirror update: {e}")
        return {
            "overall_reflection": f"{current_reflection} (attuned: {user_message})",
            "ideal_reflection": f"{current_ideal} (attuned: {user_message})",
            "attachment_style": attachment_style,
            "insight": f"Attuned: {user_message[:30]}"
        }

