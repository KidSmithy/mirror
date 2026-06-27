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

class ProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    name: str
    overall_reflection: str
    attachment_style: str
    ideal_reflection: Optional[str] = None
    ideal_image_url: Optional[str] = None

class ReflectionResponse(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    overall_reflection: str
    attachment_style: str
    insight: Optional[str] = None
    image_url: Optional[str] = None


