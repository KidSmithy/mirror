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

    monkeypatch.setenv("OPENAI_API_KEY", "mock-openai-key") # prevent real API calls if they try to invoke openai
    monkeypatch.setattr(app.main, "generate_reflection_image", lambda prompt: "/generated_images/mock_test_image.png")
    
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

def test_profile_registration():
    from app.main import app
    client = TestClient(app)
    
    new_uuid = "55555555-6666-7777-8888-999999999999"
    payload = {
        "id": new_uuid,
        "name": "Sarah Test",
        "overall_reflection": "You lean anxious but search for security.",
        "attachment_style": "Anxious-leaning"
    }
    
    # 1. Register profile
    post_res = client.post("/api/profile", json=payload)
    assert post_res.status_code == 200, f"Register failed: {post_res.text}"
    profile_data = post_res.json()
    assert profile_data["id"] == new_uuid
    assert profile_data["name"] == "Sarah Test"
    assert profile_data["attachment_style"] == "Anxious-leaning"
    
    # 2. Get profile and verify it returns from DB
    get_res = client.get("/api/profile", headers={"x-user-id": new_uuid})
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["name"] == "Sarah Test"
    assert get_data["attachment_style"] == "Anxious-leaning"

    # 3. Get attachment map for this new user (should initialize automatically based on style)
    map_res = client.get("/api/attachment-map", headers={"x-user-id": new_uuid})
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert map_data["user_id"] == new_uuid
    assert map_data["anxious_count"] == 15 # since Anxious-leaning
    assert map_data["avoidant_count"] == 5
    assert map_data["secure_count"] == 10

    # 4. Get reflections for new user (should contain 1 initial reflection with the generated/fallback image_url)
    ref_res = client.get("/api/reflections", headers={"x-user-id": new_uuid})
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert len(ref_data) == 1
    assert ref_data[0]["image_url"] is not None
