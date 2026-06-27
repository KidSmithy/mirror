import uuid
from datetime import datetime, date
from typing import List, Optional
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import supabase_client
from app.models import (
    JournalCreate, JournalResponse,
    ChatCreate, ChatResponse,
    ObservationFeedback, ObservationResponse,
    AttachmentMapResponse, ProfileResponse
)
from app.ai import (
    generate_therapist_response,
    generate_journal_tags,
    generate_weekly_observations
)

app = FastAPI(title="Mirror API", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to extract user_id from headers
def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    # Default to Enkh's test user UUID if header is not provided
    DEFAULT_USER_ID = "e1a8b9c8-1234-5678-abcd-ef0123456789"
    return x_user_id or DEFAULT_USER_ID

@app.get("/api/profile", response_model=ProfileResponse)
def get_profile(user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        response = supabase_client.table("profiles").select("*").eq("id", uid).execute()
        if response.data:
            return response.data[0]
        
        # Fallback to mock profile if DB is empty or lacks this profile
        mock_profiles = {
            "e1a8b9c8-1234-5678-abcd-ef0123456789": {
                "id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                "email": "enkh@mirror.ai",
                "name": "Enkh",
                "overall_reflection": "You seek safety in proximity, holding tight to avoid the chill of distance. Your reflection shows a deeply caring heart that sometimes forgets its own boundaries in the search for reassurance. In silence, you hear rejection; in space, you fear abandonment. The mirror invites you to breathe, to step back, and to trust that you are whole even when standing alone.",
                "attachment_style": "Anxious-leaning"
            },
            "f2b9c0d1-2345-6789-bcde-f0123456789a": {
                "id": "f2b9c0d1-2345-6789-bcde-f0123456789a",
                "email": "alex@mirror.ai",
                "name": "Alex",
                "overall_reflection": "You have built beautiful, sturdy walls to protect your quiet center, equating independence with survival. Your reflection shows a self-reliant soul who hesitates to let others see the vulnerability underneath. When others reach out, you step back to catch your breath. The mirror invites you to lower the drawbridge, even a fraction, and discover that connection does not mean captivity.",
                "attachment_style": "Avoidant-leaning"
            },
            "a3c0d1e2-3456-7890-cdef-0123456789ab": {
                "id": "a3c0d1e2-3456-7890-cdef-0123456789ab",
                "email": "taylor@mirror.ai",
                "name": "Taylor",
                "overall_reflection": "You move through relationships with a steady, grounded rhythm, comfortable with both closeness and solitude. Your reflection shows a balanced self that communicates clearly and trusts others. You do not fear the distance, nor do you fear the embrace. The mirror celebrates your clarity and invites you to keep holding space for others to find their footing.",
                "attachment_style": "Secure"
            },
            "b4d1e2f3-4567-8901-def0-123456789abc": {
                "id": "b4d1e2f3-4567-8901-def0-123456789abc",
                "email": "jordan@mirror.ai",
                "name": "Jordan",
                "overall_reflection": "You exist in a delicate dance of approach and retreat, craving the warmth of closeness while fearing the fire of vulnerability. Your reflection shows a highly sensitive heart that sees safety as a moving target. You reach out, then pull back when the distance grows too small. The mirror invites you to recognize this cycle and find a steady anchor within yourself.",
                "attachment_style": "Fearful-avoidant (disorganized)"
            },
            "c5e2f3a4-5678-9012-ef01-23456789abcd": {
                "id": "c5e2f3a4-5678-9012-ef01-23456789abcd",
                "email": "morgan@mirror.ai",
                "name": "Morgan",
                "overall_reflection": "You are highly attuned to the emotional weather of those around you, scanning for changes in wind and tide. Your reflection shows a vigilant heart that seeks a secure harbor. You worry that if you stop tending the flame, the warmth will disappear. The mirror invites you to rest and realize that you are worthy of love without constantly earning it.",
                "attachment_style": "Anxious-leaning"
            }
        }
        fallback = mock_profiles.get(uid)
        if fallback:
            return fallback
        
        raise HTTPException(status_code=404, detail="Profile not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@app.get("/api/journals", response_model=List[JournalResponse])
def get_journals(user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        response = supabase_client.table("journals").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/journals", response_model=JournalResponse)
def create_journal(journal: JournalCreate, user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    
    # 1. Call Gemini to analyze the journal content and extract hashtags
    tags = generate_journal_tags(journal.content)
    
    # 2. Prepare database record
    new_journal = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "created_at": datetime.utcnow().isoformat(),
        "content": journal.content,
        "tags": tags,
        "voice_duration": journal.voice_duration
    }
    
    try:
        response = supabase_client.table("journals").insert(new_journal).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save journal entry.")
        
        # After a new journal, optionally update the attachment map values dynamically
        update_attachment_map_counts(uid, tags)
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.get("/api/chats", response_model=List[ChatResponse])
def get_chats(user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        response = supabase_client.table("chats").select("*").eq("user_id", uid).order("created_at", desc=False).execute()
        # Seed an initial greeting if chat is completely empty
        if not response.data:
            initial_chat = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "created_at": datetime.utcnow().isoformat(),
                "sender": "them",
                "message": "What's on your mind tonight?"
            }
            supabase_client.table("chats").insert(initial_chat).execute()
            return [initial_chat]
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/chats", response_model=ChatResponse)
def create_chat(chat: ChatCreate, user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    
    # 1. Save user's message to database
    user_message = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "created_at": datetime.utcnow().isoformat(),
        "sender": "me",
        "message": chat.message
    }
    
    try:
        supabase_client.table("chats").insert(user_message).execute()
        
        # 2. Retrieve recent chat history to provide context to the Therapist agent
        history_response = supabase_client.table("chats").select("*").eq("user_id", uid).order("created_at", desc=False).execute()
        chat_history = history_response.data
        
        # 3. Call Gemini to generate the Socratic Therapist response
        therapist_reply_text = generate_therapist_response(chat_history)
        
        # 4. Save Therapist's message to database
        therapist_message = {
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "created_at": datetime.utcnow().isoformat(),
            "sender": "them",
            "message": therapist_reply_text
        }
        response = supabase_client.table("chats").insert(therapist_message).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to save therapist response.")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {e}")

@app.get("/api/observations", response_model=List[ObservationResponse])
def get_observations(user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        response = supabase_client.table("observations").select("*").eq("user_id", uid).order("week_num", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/observations/{obs_id}/feedback", response_model=ObservationResponse)
def submit_observation_feedback(obs_id: str, feedback_data: ObservationFeedback, user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        # Verify ownership and update feedback
        response = supabase_client.table("observations").update({
            "feedback": feedback_data.feedback,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", obs_id).eq("user_id", uid).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Observation not found or unauthorized.")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/observations/generate", response_model=List[ObservationResponse])
def generate_mirror_observations(user_id: str = Header(None, alias="x-user-id")):
    """
    Trigger the weekly Mirror pipeline: analyzes all user's writing (journals + chats) using Gemini
    and writes newly generated observations to the database.
    """
    uid = get_current_user_id(user_id)
    try:
        # 1. Fetch user's entire history
        journals = supabase_client.table("journals").select("*").eq("user_id", uid).execute().data
        chats = supabase_client.table("chats").select("*").eq("user_id", uid).execute().data
        
        if not journals and not chats:
            raise HTTPException(status_code=400, detail="No writing history available to analyze.")
            
        # 2. Call the Unconscious Agent (The Mirror) to generate insights
        insights = generate_weekly_observations(journals, chats)
        
        # 3. Save generated observations to database
        saved_observations = []
        # Calculate current week number
        current_week = 12 # Mocking Week 12 for UI consistency
        
        for ins in insights:
            obs_record = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "week_num": current_week,
                "category": ins.get("category", "pattern"),
                "quote": ins.get("quote"),
                "evidence": ins.get("evidence"),
                "feedback": None,
                "updated_at": datetime.utcnow().isoformat()
            }
            supabase_client.table("observations").insert(obs_record).execute()
            saved_observations.append(obs_record)
            
        return saved_observations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mirror pipeline failed: {e}")

@app.get("/api/attachment-map", response_model=AttachmentMapResponse)
def get_attachment_map(user_id: str = Header(None, alias="x-user-id")):
    uid = get_current_user_id(user_id)
    try:
        response = supabase_client.table("attachment_map").select("*").eq("user_id", uid).execute()
        if response.data:
            # If multiple records, return the most recent
            return response.data[-1]
        
        # If no record exists, build a default starting map based on user's attachment style
        default_maps = {
            "e1a8b9c8-1234-5678-abcd-ef0123456789": {"anxious_count": 12, "avoidant_count": 7, "secure_count": 19}, # Enkh
            "f2b9c0d1-2345-6789-bcde-f0123456789a": {"anxious_count": 5, "avoidant_count": 16, "secure_count": 10},  # Alex
            "a3c0d1e2-3456-7890-cdef-0123456789ab": {"anxious_count": 3, "avoidant_count": 4, "secure_count": 28},   # Taylor
            "b4d1e2f3-4567-8901-def0-123456789abc": {"anxious_count": 15, "avoidant_count": 14, "secure_count": 6},  # Jordan
            "c5e2f3a4-5678-9012-ef01-23456789abcd": {"anxious_count": 14, "avoidant_count": 8, "secure_count": 15},  # Morgan
        }
        
        defaults = default_maps.get(uid, {"anxious_count": 10, "avoidant_count": 10, "secure_count": 10})
        new_map = {
            "user_id": uid,
            "date": date.today().isoformat(),
            **defaults
        }
        supabase_client.table("attachment_map").insert(new_map).execute()
        return new_map
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

def update_attachment_map_counts(user_id: str, tags: List[str]):
    """
    Utility helper that updates user attachment scores dynamically when they post journals.
    """
    try:
        response = supabase_client.table("attachment_map").select("*").eq("user_id", user_id).execute()
        if not response.data:
            return
            
        current_map = response.data[-1]
        anxious = current_map.get("anxious_count", 0)
        avoidant = current_map.get("avoidant_count", 0)
        secure = current_map.get("secure_count", 0)
        
        for t in tags:
            tag_clean = t.lower()
            if "anxious" in tag_clean or "check" in tag_clean:
                anxious += 1
            elif "avoid" in tag_clean or "distance" in tag_clean:
                avoidant += 1
            else:
                secure += 1
                
        supabase_client.table("attachment_map").update({
            "anxious_count": anxious,
            "avoidant_count": avoidant,
            "secure_count": secure,
            "date": date.today().isoformat()
        }).eq("user_id", user_id).execute()
    except Exception as e:
        logger.error(f"Failed to update attachment map metrics: {e}")
