import os
import tempfile
import json
import pytest
from app.db import MockSupabaseClient

def test_mock_db_crud():
    # Setup temporary file path
    fd, temp_path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    if os.path.exists(temp_path):
        os.remove(temp_path)

    try:
        # Initialize client with test database path
        client = MockSupabaseClient(db_path=temp_path)

        # 1. Test Select default observations
        obs_res = client.table("observations").select().execute()
        assert len(obs_res.data) == 2
        assert obs_res.data[0]["id"] == "obs1-uuid"

        # 2. Test Insert
        new_chat = {
            "id": "test-chat-1",
            "user_id": "test-user-id",
            "sender": "me",
            "message": "Hello therapist",
            "topic": "relationship"
        }
        insert_res = client.table("chats").insert(new_chat).execute()
        assert len(insert_res.data) == 1
        assert insert_res.data[0]["id"] == "test-chat-1"

        # Verify it auto-saved to our temporary file
        assert os.path.exists(temp_path)
        with open(temp_path, "r") as f:
            data = json.load(f)
            assert len(data["chats"]) == 1
            assert data["chats"][0]["id"] == "test-chat-1"

        # 3. Test Select with Filters
        filtered_res = client.table("chats").select().eq("topic", "relationship").execute()
        assert len(filtered_res.data) == 1

        filtered_res_empty = client.table("chats").select().eq("topic", "mental").execute()
        assert len(filtered_res_empty.data) == 0

        # 4. Test Update
        client.table("chats").update({"message": "Updated message"}).eq("id", "test-chat-1").execute()
        with open(temp_path, "r") as f:
            data = json.load(f)
            assert data["chats"][0]["message"] == "Updated message"

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
