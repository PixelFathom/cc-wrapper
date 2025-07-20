#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_chat_flow():
    """Test the complete chat flow"""
    
    print("Testing Chat Flow")
    print("=" * 50)
    
    # Test 1: First message (no session_id)
    print("\n1. Sending first message (no session_id)...")
    response = requests.post(f"{BASE_URL}/query", json={
        "prompt": "Hello, can you help me?",
        "org_name": "default",
        "cwd": "ads/enhancement/sub1"
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Response received:")
        print(f"  - Session ID: {data.get('session_id')}")
        print(f"  - Chat ID: {data.get('chat_id')}")
        print(f"  - Response: {data.get('assistant_response')[:100]}...")
        
        session_id = data.get('session_id')
        
        # Wait a bit for processing
        time.sleep(2)
        
        # Test 2: Second message (with session_id)
        print(f"\n2. Sending second message (with session_id: {session_id})...")
        response2 = requests.post(f"{BASE_URL}/query", json={
            "prompt": "What can you do?",
            "session_id": session_id,
            "org_name": "default", 
            "cwd": "ads/enhancement/sub1"
        })
        
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"✓ Response received:")
            print(f"  - Session ID: {data2.get('session_id')}")
            print(f"  - Chat ID: {data2.get('chat_id')}")
            print(f"  - Response: {data2.get('assistant_response')[:100]}...")
            
            # Verify session continuity
            if data2.get('session_id') == session_id:
                print("✓ Session continuity maintained!")
            else:
                print("✗ Session ID changed unexpectedly!")
                
        else:
            print(f"✗ Second message failed: {response2.status_code}")
            print(response2.text)
            
        # Test 3: Get all messages in session
        print(f"\n3. Getting all messages for session {session_id}...")
        response3 = requests.get(f"{BASE_URL}/chats/session/{session_id}")
        
        if response3.status_code == 200:
            data3 = response3.json()
            print(f"✓ Found {len(data3.get('messages', []))} messages")
            for msg in data3.get('messages', []):
                print(f"  - [{msg['role']}] {msg['content'].get('text', '')[:50]}...")
        else:
            print(f"✗ Failed to get session messages: {response3.status_code}")
            
    else:
        print(f"✗ First message failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_chat_flow()