#!/usr/bin/env python3
"""
Test script to verify chat conversation flow continuity
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def log(message, level="INFO"):
    """Print with timestamp and level"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")
    sys.stdout.flush()

def test_conversation_flow():
    """Test that conversations maintain continuity across session changes"""
    log("=" * 80)
    log("TESTING CONVERSATION FLOW CONTINUITY")
    log("=" * 80)
    
    cwd = "TestProject/TestTask"
    
    # Test 1: Send first message
    log("\n1. Sending first message...")
    first_message = {
        "prompt": "Hello! This is my first message. Please remember this.",
        "org_name": "default", 
        "cwd": cwd
    }
    
    response = requests.post(f"{BASE_URL}/query", json=first_message)
    if response.status_code != 200:
        log(f"❌ First message failed: {response.status_code} - {response.text}", "ERROR")
        return
    
    data1 = response.json()
    session_id_1 = data1.get('session_id')
    chat_id_1 = data1.get('chat_id')
    
    log(f"✅ First message sent:")
    log(f"  Session ID: {session_id_1}")
    log(f"  Chat ID: {chat_id_1}")
    
    # Wait for processing
    time.sleep(2)
    
    # Test 2: Check session messages after first message
    log("\n2. Checking session messages after first message...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id_1}")
    if response.status_code == 200:
        session_data = response.json()
        messages_count = len(session_data.get('messages', []))
        log(f"✅ Found {messages_count} messages in session")
        
        for i, msg in enumerate(session_data.get('messages', [])):
            log(f"  Message {i+1}: {msg['role']} - {msg['content'].get('text', '')[:50]}...")
    else:
        log(f"❌ Failed to get session messages: {response.status_code}", "ERROR")
    
    # Test 3: Send second message with session_id
    log(f"\n3. Sending second message with session_id: {session_id_1}")
    second_message = {
        "prompt": "This is my second message. Do you remember my first message?",
        "session_id": session_id_1,
        "org_name": "default",
        "cwd": cwd
    }
    
    response = requests.post(f"{BASE_URL}/query", json=second_message)
    if response.status_code != 200:
        log(f"❌ Second message failed: {response.status_code} - {response.text}", "ERROR")
        return
    
    data2 = response.json()
    session_id_2 = data2.get('session_id')
    chat_id_2 = data2.get('chat_id')
    
    log(f"✅ Second message sent:")
    log(f"  Session ID: {session_id_2}")
    log(f"  Chat ID: {chat_id_2}")
    log(f"  Session changed: {session_id_1 != session_id_2}")
    
    # Wait for processing
    time.sleep(3)
    
    # Test 4: Check final session messages
    log(f"\n4. Checking final session messages...")
    
    # Check both sessions
    for sid in [session_id_1, session_id_2]:
        if sid:
            response = requests.get(f"{BASE_URL}/chats/session/{sid}")
            if response.status_code == 200:
                session_data = response.json()
                messages_count = len(session_data.get('messages', []))
                log(f"📊 Session {sid[:8]}... has {messages_count} messages")
                
                for i, msg in enumerate(session_data.get('messages', [])):
                    log(f"    {i+1}. {msg['role']}: {msg['content'].get('text', '')[:100]}...")
            else:
                log(f"❌ Failed to get session {sid}: {response.status_code}", "ERROR")
    
    # Test 5: Summary
    log("\n" + "=" * 80)
    log("CONVERSATION FLOW TEST SUMMARY")
    log("=" * 80)
    log(f"1. First message session: {session_id_1}")
    log(f"2. Second message session: {session_id_2}")
    log(f"3. Session changed: {session_id_1 != session_id_2}")
    log("4. Expected: All messages should be visible in the active session")
    log("5. Check the logs above to verify message continuity")

if __name__ == "__main__":
    test_conversation_flow()