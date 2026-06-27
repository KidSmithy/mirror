import logging
import os
import json
from datetime import date
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger("mirror-db")

class _MockResponse:
    def __init__(self, data):
        self.data = data

# Local JSON database fallback for seamless developer testing
class MockQueryBuilder:
    def __init__(self, table_name: str, db_store: dict, save_callback=None):
        self.table_name = table_name
        self.db_store = db_store
        self.filters = []
        self.order_by = None
        self.order_desc = False
        self.insert_data = None
        self.update_data = None
        self.save_callback = save_callback

    def select(self, columns: str = "*"):
        return self

    def eq(self, column: str, value: str):
        self.filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self.order_by = column
        self.order_desc = desc
        return self

    def insert(self, data: dict):
        self.insert_data = data
        return self

    def update(self, data: dict):
        self.update_data = data
        return self

    def execute(self):
        if self.insert_data is not None:
            records = self.db_store.setdefault(self.table_name, [])
            if isinstance(self.insert_data, list):
                for item in self.insert_data:
                    records.append(item)
                inserted_data = self.insert_data
            else:
                records.append(self.insert_data)
                inserted_data = [self.insert_data]
            if self.save_callback:
                self.save_callback()
            return _MockResponse(inserted_data)

        if self.update_data is not None:
            records = self.db_store.get(self.table_name, [])
            updated = []
            for r in records:
                match = True
                for col, val in self.filters:
                    if r.get(col) != val:
                        match = False
                        break
                if match:
                    r.update(self.update_data)
                    updated.append(r)
            if self.save_callback:
                self.save_callback()
            return _MockResponse(updated)

        # Otherwise, perform select query
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
        
        return _MockResponse(filtered_records)

class MockSupabaseClient:
    def __init__(self, db_path=None):
        self.db_path = db_path or os.getenv("MOCK_DB_PATH") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mock_db.json"))
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
                    "date": date.today().isoformat(),
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
                    "attachment_style": "Anxious-leaning",
                    "ideal_reflection": "Your ideal self is secure and anchored. You communicate your boundaries clearly and trust that you are worthy of love without constant performance. You have found peace in the space between closeness and independence, viewing solitude not as abandonment, but as a gentle return to yourself.",
                    "ideal_image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"
                },
                {
                    "id": "f2b9c0d1-2345-6789-bcde-f0123456789a",
                    "email": "alex@mirror.ai",
                    "name": "Alex",
                    "overall_reflection": "You have built beautiful, sturdy walls to protect your quiet center, equating independence with survival. Your reflection shows a self-reliant soul who hesitates to let others see the vulnerability underneath. When others reach out, you step back to catch your breath. The mirror invites you to lower the drawbridge, even a fraction, and discover that connection does not mean captivity.",
                    "attachment_style": "Avoidant-leaning",
                    "ideal_reflection": "Your ideal self is secure and comfortable letting down your walls. You see closeness not as a threat to your autonomy, but as a space of deep mutual rest.",
                    "ideal_image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"
                },
                {
                    "id": "a3c0d1e2-3456-7890-cdef-0123456789ab",
                    "email": "taylor@mirror.ai",
                    "name": "Taylor",
                    "overall_reflection": "You move through relationships with a steady, grounded rhythm, comfortable with both closeness and solitude. Your reflection shows a balanced self that communicates clearly and trusts others. You do not fear the distance, nor do you fear the embrace. The mirror celebrates your clarity and invites you to keep holding space for others to find their footing.",
                    "attachment_style": "Secure",
                    "ideal_reflection": "Your ideal self is already grounded, continually refining your active listening skills and offering secure co-regulation to those around you.",
                    "ideal_image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"
                },
                {
                    "id": "b4d1e2f3-4567-8901-def0-123456789abc",
                    "email": "jordan@mirror.ai",
                    "name": "Jordan",
                    "overall_reflection": "You exist in a delicate dance of approach and retreat, craving the warmth of closeness while fearing the fire of vulnerability. Your reflection shows a highly sensitive heart that sees safety as a moving target. You reach out, then pull back when the distance grows too small. The mirror invites you to recognize this cycle and find a steady anchor within yourself.",
                    "attachment_style": "Fearful-avoidant (disorganized)",
                    "ideal_reflection": "Your ideal self has integrated the split between craving and fearing intimacy, recognizing safety as an internal anchor that others cannot take away.",
                    "ideal_image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"
                },
                {
                    "id": "c5e2f3a4-5678-9012-ef01-23456789abcd",
                    "email": "morgan@mirror.ai",
                    "name": "Morgan",
                    "overall_reflection": "You are highly attuned to the emotional weather of those around you, scanning for changes in wind and tide. Your reflection shows a vigilant heart that seeks a secure harbor. You worry that if you stop tending the flame, the warmth will disappear. The mirror invites you to rest and realize that you are worthy of love without constantly earning it.",
                    "attachment_style": "Anxious-leaning",
                    "ideal_reflection": "Your ideal self trusts that space does not mean deletion, knowing that connection remains secure even during moments of silence.",
                    "ideal_image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_ideal.png"
                }
            ],
            "reflections": [
                {
                    "id": "11111111-2222-3333-4444-555555555551",
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                    "created_at": "2026-06-01T12:00:00Z",
                    "overall_reflection": "You are highly active, checking constantly for validation. Your pulse spikes during silences and you feel a powerful urge to double-text or explain yourself to prevent distance. The fear of quietness is extremely high, prompting immediate anxious checking behavior.",
                    "attachment_style": "Anxious-leaning",
                    "insight": "Initial attunement: Recognized hyper-vigilance during relationship silence.",
                    "image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_june1.png"
                },
                {
                    "id": "11111111-2222-3333-4444-555555555552",
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                    "created_at": "2026-06-12T12:00:00Z",
                    "overall_reflection": "You are beginning to step back and recognize the space you need. While the anxiety is still present, you are pausing before checking your phone, attempting to sit with the silence. There is a slight calming of the pulse as you intellectualize the urge to merge.",
                    "attachment_style": "Anxious-leaning (aware)",
                    "insight": "Behavior shift: Paused double-texting urge and noted body tension instead.",
                    "image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_june12.png"
                },
                {
                    "id": "11111111-2222-3333-4444-555555555553",
                    "user_id": "e1a8b9c8-1234-5678-abcd-ef0123456789",
                    "created_at": "2026-06-27T12:00:00Z",
                    "overall_reflection": "You seek safety in proximity, holding tight to avoid the chill of distance. Your reflection shows a deeply caring heart that sometimes forgets its own boundaries in the search for reassurance. In silence, you hear rejection; in space, you fear abandonment. The mirror invites you to breathe, to step back, and to trust that you are whole even when standing alone.",
                    "attachment_style": "Anxious-leaning (healing)",
                    "insight": "Self-soothing: Attuned to the difference between space and abandonment.",
                    "image_url": "https://uqsflvuuhbxkgmrydvdd.supabase.co/storage/v1/object/public/reflections/enkh_june27.png"
                }
            ]
        }
        self._load_db()

    def _load_db(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        for k, v in loaded.items():
                            self.db_store[k] = v
                logger.info(f"Loaded local mock database from {self.db_path}")
            except Exception as e:
                logger.error(f"Failed to load mock db file: {e}")
        else:
            self._save_db()

    def _save_db(self):
        try:
            with open(self.db_path, "w") as f:
                json.dump(self.db_store, f, indent=2)
            logger.info(f"Saved local mock database to {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to save mock db file: {e}")

    def table(self, table_name: str):
        return MockQueryBuilder(table_name, self.db_store, save_callback=self._save_db)

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
    logger.warning("Supabase URL or Key not set. Running with local mock database.")
    supabase_client = MockSupabaseClient()
