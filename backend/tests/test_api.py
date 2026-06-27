import os
import tempfile
import pytest
from fastapi.testclient import TestClient

@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    # Set mock db path and credentials
    fd, temp_path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # Directly instantiate and inject MockSupabaseClient
    from app.db import MockSupabaseClient
    import app.db
    import app.main

    mock_client = MockSupabaseClient(db_path=temp_path)
    app.db.supabase_client = mock_client
    app.main.supabase_client = mock_client

    monkeypatch.setenv("GEMINI_API_KEY", "mock-gemini-key") # prevent real API calls if they try to invoke genai
    
    yield

    if os.path.exists(temp_path):
        os.remove(temp_path)

def test_chat_topic_isolation():
    from app.main import app
    client = TestClient(app)
    headers = {"x-user-id": "test-user-id"}

    # 1. GET relationship topic (should seed relationship introductory message)
    res = client.get("/api/chats?topic=relationship", headers=headers)
    assert res.status_code == 200, f"Response text was: {res.text}"
    data = res.json()
    assert len(data) == 1
    assert data[0]["sender"] == "them"
    assert data[0]["topic"] == "relationship"
    assert "connections" in data[0]["message"].lower()

    # 2. GET general topic (should seed general introductory message)
    res_gen = client.get("/api/chats?topic=general", headers=headers)
    assert res_gen.status_code == 200
    data_gen = res_gen.json()
    assert len(data_gen) == 1
    assert data_gen[0]["sender"] == "them"
    assert data_gen[0]["topic"] == "general"
    assert "mind" in data_gen[0]["message"].lower()

    # 3. POST chat message to relationship topic
    post_res = client.post(
        "/api/chats", 
        json={"message": "I am feeling distant.", "topic": "relationship"}, 
        headers=headers
    )
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert post_data["sender"] == "them"
    assert post_data["topic"] == "relationship"

    # Verify that relationship thread now has 3 messages (intro greeting, user post, and therapist reply)
    res_rel_updated = client.get("/api/chats?topic=relationship", headers=headers)
    assert len(res_rel_updated.json()) == 3

    # Verify that general thread remains untouched with only 1 message
    res_gen_updated = client.get("/api/chats?topic=general", headers=headers)
    assert len(res_gen_updated.json()) == 1
