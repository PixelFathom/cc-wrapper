#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_webhook_update():
    """Test webhook update flow with a simulated successful response"""
    
    print("Testing webhook update flow")
    print("=" * 50)
    
    # First, create a message
    print("\n1. Creating a test message...")
    response = requests.post(f"{BASE_URL}/query", json={
        "prompt": "Test message for webhook update",
        "org_name": "default",
        "cwd": "ads/enhancement/sub1"
    })
    
    if response.status_code != 200:
        print(f"Failed to create message: {response.status_code}")
        return
    
    data = response.json()
    chat_id = data.get('chat_id')
    session_id = data.get('session_id')
    
    print(f"✓ Message created:")
    print(f"  - Chat ID: {chat_id}")
    print(f"  - Session ID: {session_id}")
    
    # Wait a moment
    import time
    time.sleep(2)
    
    # Send a successful webhook
    print(f"\n2. Sending successful webhook to /api/webhooks/chat/{chat_id}...")
    webhook_payload = {
        "type": "processing",
        "status": "completed",
        "result": "Based on what you told me earlier, your name is TestUser and you like Python programming. This is a test of conversation continuity.",
        "task_id": "test-task-123",
        "session_id": session_id,
        "conversation_id": chat_id,
        "timestamp": "2025-07-19T07:00:00.000000"
    }
    
    webhook_response = requests.post(
        f"{BASE_URL}/webhooks/chat/{chat_id}",
        json=webhook_payload
    )
    
    print(f"Webhook response: {webhook_response.status_code}")
    if webhook_response.status_code == 200:
        print("✓ Webhook processed successfully")
    else:
        print(f"✗ Webhook failed: {webhook_response.text}")
    
    # Check the messages again
    time.sleep(1)
    print(f"\n3. Checking messages in session {session_id}...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        print(f"Found {len(messages)} messages:")
        for msg in messages:
            role = msg['role']
            content = msg['content'].get('text', '')[:100]
            print(f"  [{role}] {content}...")

if __name__ == "__main__":
    test_webhook_update()