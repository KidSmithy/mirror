from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date

class JournalCreate(BaseModel):
    content: str
    voice_duration: Optional[int] = None

class JournalResponse(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    content: str
    tags: List[str]
    voice_duration: Optional[int] = None

class ChatCreate(BaseModel):
    message: str

class ChatResponse(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    sender: str
    message: str

class ObservationFeedback(BaseModel):
    feedback: str # 'lands', 'not_yet', 'say_more'

class ObservationResponse(BaseModel):
    id: str
    user_id: str
    week_num: int
    category: str
    quote: str
    evidence: str
    feedback: Optional[str] = None
    updated_at: Optional[datetime] = None

class AttachmentMapResponse(BaseModel):
    user_id: str
    date: date
    anxious_count: int
    avoidant_count: int
    secure_count: int

class OnboardingAssess(BaseModel):
    answers: List[str]

class AssessmentResponse(BaseModel):
    primary_style: str
    secondary_style: Optional[str] = None
    pattern_name: str
    description: str
    quote: str
    triggers: List[str] = []
