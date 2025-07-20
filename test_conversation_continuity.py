#!/usr/bin/env python3
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000/api"

def log(message):
    """Print with timestamp"""
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()

def test_conversation_continuity():
    """Test the complete conversation continuity flow"""
    
    log("Testing Conversation Continuity")
    log("=" * 70)
    
    # Test 1: First message (no session_id)
    log("\n📤 TEST 1: Sending first message (no session_id)...")
    response = requests.post(f"{BASE_URL}/query", json={
        "prompt": "Hello, my name is TestUser and I like Python programming",
        "org_name": "default",
        "cwd": "ads/enhancement/sub1"
    })
    
    if response.status_code != 200:
        log(f"❌ First message failed: {response.status_code}")
        log(f"Response: {response.text}")
        return
    
    data = response.json()
    log(f"✅ Response received:")
    log(f"   - Session ID: {data.get('session_id')}")
    log(f"   - Chat ID: {data.get('chat_id')}")
    log(f"   - Assistant response: {data.get('assistant_response')[:100]}...")
    
    session_id = data.get('session_id')
    first_chat_id = data.get('chat_id')
    
    # Wait for webhooks to process
    log("\n⏳ Waiting 5 seconds for webhooks to process...")
    time.sleep(5)
    
    # Check messages in session
    log(f"\n🔍 Checking messages in session {session_id}...")
    response2 = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response2.status_code == 200:
        messages = response2.json().get('messages', [])
        log(f"✅ Found {len(messages)} messages in session:")
        for i, msg in enumerate(messages, 1):
            content = msg['content'].get('text', '')[:80]
            log(f"   {i}. [{msg['role']:9s}] {content}...")
    else:
        log(f"❌ Failed to get session messages: {response2.status_code}")
    
    # Check hooks for the first message
    log(f"\n🔍 Checking hooks for first message (chat_id: {first_chat_id})...")
    response3 = requests.get(f"{BASE_URL}/chats/{first_chat_id}/hooks")
    
    if response3.status_code == 200:
        hooks = response3.json().get('hooks', [])
        log(f"✅ Found {len(hooks)} hooks:")
        for hook in hooks:
            log(f"   - [{hook['status']:12s}] {hook.get('step_name', hook['hook_type'])}")
            if hook['data'].get('session_id'):
                log(f"     └─ session_id: {hook['data']['session_id']}")
    
    # Test 2: Second message (with session_id)
    log(f"\n📤 TEST 2: Sending second message WITH session_id: {session_id}...")
    response4 = requests.post(f"{BASE_URL}/query", json={
        "prompt": "What is my name and what programming language do I like?",
        "session_id": session_id,
        "org_name": "default", 
        "cwd": "ads/enhancement/sub1"
    })
    
    if response4.status_code != 200:
        log(f"❌ Second message failed: {response4.status_code}")
        log(f"Response: {response4.text}")
        return
    
    data2 = response4.json()
    log(f"✅ Response received:")
    log(f"   - Session ID: {data2.get('session_id')}")
    log(f"   - Chat ID: {data2.get('chat_id')}")
    log(f"   - Assistant response: {data2.get('assistant_response')[:100]}...")
    
    second_chat_id = data2.get('chat_id')
    
    # Verify session continuity
    if data2.get('session_id') == session_id:
        log("✅ Session ID remained consistent!")
    else:
        log(f"❌ Session ID changed! Old: {session_id}, New: {data2.get('session_id')}")
    
    # Wait for webhooks
    log("\n⏳ Waiting 5 seconds for webhooks to process...")
    time.sleep(5)
    
    # Check all messages in session
    log(f"\n🔍 Checking ALL messages in session {session_id}...")
    response5 = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response5.status_code == 200:
        messages = response5.json().get('messages', [])
        log(f"✅ Found {len(messages)} messages in session:")
        for i, msg in enumerate(messages, 1):
            content = msg['content'].get('text', '')[:80]
            log(f"   {i}. [{msg['role']:9s}] {content}...")
            
        # Check if assistant replied to second message
        assistant_messages = [m for m in messages if m['role'] == 'assistant']
        if len(assistant_messages) >= 2:
            second_assistant = assistant_messages[1]
            content = second_assistant['content'].get('text', '')
            if "Error" in content:
                log(f"\n⚠️  Second assistant message is an error: {content[:100]}...")
            else:
                log(f"\n✅ Second assistant message looks good: {content[:100]}...")
        else:
            log(f"\n❌ Expected at least 2 assistant messages but found {len(assistant_messages)}")
    
    # Check hooks for second message
    log(f"\n🔍 Checking hooks for second message (chat_id: {second_chat_id})...")
    response6 = requests.get(f"{BASE_URL}/chats/{second_chat_id}/hooks")
    
    if response6.status_code == 200:
        hooks = response6.json().get('hooks', [])
        log(f"✅ Found {len(hooks)} hooks:")
        for hook in hooks:
            log(f"   - [{hook['status']:12s}] {hook.get('step_name', hook['hook_type'])}")
            if hook['data'].get('session_id'):
                log(f"     └─ session_id: {hook['data']['session_id']}")
            # Check if session_id is in the payload
            if hook['hook_type'] == 'query_initiated':
                payload = hook['data'].get('query_payload', {})
                if 'session_id' in payload:
                    log(f"     └─ payload contains session_id: {payload['session_id']}")
    
    # Test 3: Third message to really test continuity
    log(f"\n📤 TEST 3: Sending third message to verify continuity...")
    response7 = requests.post(f"{BASE_URL}/query", json={
        "prompt": "Can you repeat what I told you about myself?",
        "session_id": session_id,
        "org_name": "default", 
        "cwd": "ads/enhancement/sub1"
    })
    
    if response7.status_code == 200:
        data3 = response7.json()
        log(f"✅ Third message sent successfully")
        log(f"   - Chat ID: {data3.get('chat_id')}")
        
        # Wait and check final state
        log("\n⏳ Waiting 5 seconds for final processing...")
        time.sleep(5)
        
        response8 = requests.get(f"{BASE_URL}/chats/session/{session_id}")
        if response8.status_code == 200:
            messages = response8.json().get('messages', [])
            log(f"\n📊 FINAL SESSION STATE: {len(messages)} messages")
            
            user_messages = [m for m in messages if m['role'] == 'user']
            assistant_messages = [m for m in messages if m['role'] == 'assistant']
            
            log(f"   - User messages: {len(user_messages)}")
            log(f"   - Assistant messages: {len(assistant_messages)}")
            
            if len(assistant_messages) >= 3:
                for i, msg in enumerate(assistant_messages, 1):
                    content = msg['content'].get('text', '')[:100]
                    log(f"   - Assistant {i}: {content}...")

if __name__ == "__main__":
    test_conversation_continuity()