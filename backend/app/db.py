import logging
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger("mirror-db")

# In-memory database fallback for seamless developer testing before Supabase credentials are set
class MockQueryBuilder:
    def __init__(self, table_name: str, db_store: dict):
        self.table_name = table_name
        self.db_store = db_store
        self.filters = []
        self.order_by = None
        self.order_desc = False

    def select(self, columns: str = "*"):
        return self

    def eq(self, column: str, value: str):
        self.filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self.order_by = column
        self.order_desc = desc
        return self

    def execute(self):
        records = self.db_store.get(self.table_name, [])
        filtered_records = []
        for r in records:
            match = True
            for col, val in self.filters:
                if r.get(col) != val:
                    match = False
                    break
            if match:
                filtered_records.append(r)
        
        if self.order_by:
            filtered_records.sort(
                key=lambda x: x.get(self.order_by, ""), 
                reverse=self.order_desc
            )
        
        # Wrap in a helper class that mimics postgrest response
        class Response:
            def __init__(self, data):
                self.data = data
        return Response(filtered_records)

    def insert(self, data: dict):
        records = self.db_store.setdefault(self.table_name, [])
        # If it's a list of dicts or single dict
        if isinstance(data, list):
            for item in data:
                records.append(item)
            inserted_data = data
        else:
            records.append(data)
            inserted_data = [data]
        
        class Response:
            def __init__(self, data):
                self.data = data
        return Response(inserted_data)

    def update(self, data: dict):
        # Simply find by ID in our filters and update
        records = self.db_store.get(self.table_name, [])
        updated = []
        for r in records:
            match = True
            for col, val in self.filters:
                if r.get(col) != val:
                    match = False
                    break
            if match:
                r.update(data)
                updated.append(r)
        
        class Response:
            def __init__(self, data):
                self.data = data
        return Response(updated)

class MockSupabaseClient:
    def __init__(self):
        self.db_store = {
            "journals": [],
            "chats": [],
            "observations": [
                {
                    "id": "obs1-uuid",
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789", # Enkh
                    "week_num": 12,
                    "category": "distance",
                    "quote": "You've written about your mother 14 times this month. You've never called her 'mom.' Always 'my mother.' What might that distance protect?",
                    "evidence": "14 mentions across journal entries from June 3-25. The shift happened on March 14, the week after the call about your father.",
                    "feedback": None
                },
                {
                    "id": "obs2-uuid",
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789", # Enkh
                    "week_num": 12,
                    "category": "checking",
                    "quote": "You wrote 'I shouldn't have' seven times this week. Always after reaching out. Never after staying silent. Notice what shape that is.",
                    "evidence": "7 entries containing 'I shouldn't have' followed by a self-soothing line within 3 sentences. The shape: reach, retract, repair.",
                    "feedback": None
                }
            ],
            "attachment_map": [
                {
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                    "anxious_count": 12,
                    "avoidant_count": 7,
                    "secure_count": 19
                }
            ],
            "profiles": [
                {
                    "id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                    "email": "enkh@mirror.ai",
                    "name": "Enkh",
                    "overall_reflection": "You seek safety in proximity, holding tight to avoid the chill of distance. Your reflection shows a deeply caring heart that sometimes forgets its own boundaries in the search for reassurance. In silence, you hear rejection; in space, you fear abandonment. The mirror invites you to breathe, to step back, and to trust that you are whole even when standing alone.",
                    "attachment_style": "Anxious-leaning"
                },
                {
                    "id": "f2b9c0d1-2345-6789-bcde-f0123456789a",
                    "email": "alex@mirror.ai",
                    "name": "Alex",
                    "overall_reflection": "You have built beautiful, sturdy walls to protect your quiet center, equating independence with survival. Your reflection shows a self-reliant soul who hesitates to let others see the vulnerability underneath. When others reach out, you step back to catch your breath. The mirror invites you to lower the drawbridge, even a fraction, and discover that connection does not mean captivity.",
                    "attachment_style": "Avoidant-leaning"
                },
                {
                    "id": "a3c0d1e2-3456-7890-cdef-0123456789ab",
                    "email": "taylor@mirror.ai",
                    "name": "Taylor",
                    "overall_reflection": "You move through relationships with a steady, grounded rhythm, comfortable with both closeness and solitude. Your reflection shows a balanced self that communicates clearly and trusts others. You do not fear the distance, nor do you fear the embrace. The mirror celebrates your clarity and invites you to keep holding space for others to find their footing.",
                    "attachment_style": "Secure"
                },
                {
                    "id": "b4d1e2f3-4567-8901-def0-123456789abc",
                    "email": "jordan@mirror.ai",
                    "name": "Jordan",
                    "overall_reflection": "You exist in a delicate dance of approach and retreat, craving the warmth of closeness while fearing the fire of vulnerability. Your reflection shows a highly sensitive heart that sees safety as a moving target. You reach out, then pull back when the distance grows too small. The mirror invites you to recognize this cycle and find a steady anchor within yourself.",
                    "attachment_style": "Fearful-avoidant (disorganized)"
                },
                {
                    "id": "c5e2f3a4-5678-9012-ef01-23456789abcd",
                    "email": "morgan@mirror.ai",
                    "name": "Morgan",
                    "overall_reflection": "You are highly attuned to the emotional weather of those around you, scanning for changes in wind and tide. Your reflection shows a vigilant heart that seeks a secure harbor. You worry that if you stop tending the flame, the warmth will disappear. The mirror invites you to rest and realize that you are worthy of love without constantly earning it.",
                    "attachment_style": "Anxious-leaning"
                }
            ]
        }

    def table(self, table_name: str):
        return MockQueryBuilder(table_name, self.db_store)

# Initialize Supabase client
supabase_client = None
if settings.supabase_url and settings.supabase_key and not settings.supabase_url.startswith("https://your-supabase"):
    try:
        supabase_client: Client = create_client(settings.supabase_url, settings.supabase_key)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing Supabase client: {e}. Falling back to mock client.")
        supabase_client = MockSupabaseClient()
else:
    logger.warning("Supabase URL or Key not set. Running with local in-memory MockSupabaseClient.")
    supabase_client = MockSupabaseClient()
