#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_session_flow():
    """Test the session ID flow through multiple messages"""
    
    print("Testing Session ID Flow")
    print("=" * 50)
    
    # Test 1: First message (no session_id)
    print("\n1. Sending first message (no session_id)...")
    response = requests.post(f"{BASE_URL}/query", json={
        "prompt": "Hello, this is message 1",
        "org_name": "default",
        "cwd": "ads/enhancement/sub1"
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Response received:")
        print(f"  - Session ID returned: {data.get('session_id')}")
        print(f"  - Chat ID: {data.get('chat_id')}")
        print(f"  - Response: {data.get('assistant_response')[:100]}...")
        
        first_session_id = data.get('session_id')
        
        # Wait a bit for processing
        print("\n  Waiting 3 seconds for webhooks...")
        time.sleep(3)
        
        # Check session messages
        print(f"\n2. Checking messages for session {first_session_id}...")
        response2 = requests.get(f"{BASE_URL}/chats/session/{first_session_id}")
        
        if response2.status_code == 200:
            messages = response2.json().get('messages', [])
            print(f"✓ Found {len(messages)} messages in session")
            for msg in messages:
                print(f"  - [{msg['role']}] {msg['content'].get('text', '')[:50]}...")
        
        # Test 2: Second message (with session_id from first response)
        print(f"\n3. Sending second message with session_id: {first_session_id}...")
        response3 = requests.post(f"{BASE_URL}/query", json={
            "prompt": "This is message 2, do you remember message 1?",
            "session_id": first_session_id,
            "org_name": "default", 
            "cwd": "ads/enhancement/sub1"
        })
        
        if response3.status_code == 200:
            data3 = response3.json()
            print(f"✓ Response received:")
            print(f"  - Session ID returned: {data3.get('session_id')}")
            print(f"  - Chat ID: {data3.get('chat_id')}")
            print(f"  - Response: {data3.get('assistant_response')[:100]}...")
            
            second_session_id = data3.get('session_id')
            
            # Check if session ID changed
            if second_session_id != first_session_id:
                print(f"\n⚠️  Session ID changed!")
                print(f"  - First: {first_session_id}")
                print(f"  - Second: {second_session_id}")
            else:
                print(f"\n✓ Session ID remained consistent: {second_session_id}")
                
            # Wait for webhooks
            print("\n  Waiting 3 seconds for webhooks...")
            time.sleep(3)
            
            # Check all messages in final session
            print(f"\n4. Checking all messages in session {second_session_id}...")
            response4 = requests.get(f"{BASE_URL}/chats/session/{second_session_id}")
            
            if response4.status_code == 200:
                messages = response4.json().get('messages', [])
                print(f"✓ Found {len(messages)} messages in session")
                for i, msg in enumerate(messages):
                    print(f"  {i+1}. [{msg['role']}] {msg['content'].get('text', '')[:60]}...")
                    
                # Check hooks for the latest assistant message
                assistant_msgs = [m for m in messages if m['role'] == 'assistant']
                if assistant_msgs:
                    last_assistant = assistant_msgs[-1]
                    print(f"\n5. Checking hooks for last assistant message {last_assistant['id']}...")
                    response5 = requests.get(f"{BASE_URL}/chats/{last_assistant['id']}/hooks")
                    if response5.status_code == 200:
                        hooks = response5.json().get('hooks', [])
                        print(f"✓ Found {len(hooks)} hooks")
                        for hook in hooks[:5]:  # Show first 5 hooks
                            print(f"  - [{hook['status']}] {hook.get('step_name', hook['hook_type'])}")
                
        else:
            print(f"✗ Second message failed: {response3.status_code}")
            print(response3.text)
            
    else:
        print(f"✗ First message failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_session_flow()