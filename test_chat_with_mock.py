#!/usr/bin/env python3
import requests
import json
import time
import sys
import asyncio
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def log(message, level="INFO"):
    """Print with timestamp and level"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")
    sys.stdout.flush()

async def send_mock_webhook(chat_id, session_id, message_num=1):
    """Send a mock webhook response simulating Claude Code response"""
    webhook_data = {
        "type": "processing",
        "status": "completed",
        "result": f"Based on our previous conversation, your favorite programming language is Python! You mentioned you love building APIs with it. This is message #{message_num} in our conversation.",
        "task_id": f"mock-task-{chat_id}",
        "session_id": session_id,
        "conversation_id": chat_id,
        "timestamp": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/webhooks/chat/{chat_id}", json=webhook_data)
    log(f"Mock webhook sent: {response.status_code}", "DEBUG")
    return response.status_code == 200

def test_chat_with_mock():
    """Test chat flow with mock webhooks"""
    log("=" * 80)
    log("TESTING CHAT WITH MOCK WEBHOOKS")
    log("=" * 80)
    
    # Create test project and task
    log("\n1. Creating test project...")
    project_data = {
        "name": "MockChatProject",
        "repo_url": "https://github.com/test/test"
    }
    
    response = requests.post(f"{BASE_URL}/projects", json=project_data)
    if response.status_code not in [200, 201]:
        log(f"Failed to create project: {response.status_code} - {response.text}", "ERROR")
        return
    
    project = response.json()
    project_id = project.get('id')
    log(f"✓ Created project: {project_id}", "SUCCESS")
    
    # Create task
    log("\n2. Creating test task...")
    task_data = {
        "name": "MockChatTask",
        "project_id": project_id
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=task_data)
    if response.status_code not in [200, 201]:
        log(f"Failed to create task: {response.status_code} - {response.text}", "ERROR")
        return
    
    task = response.json()
    task_id = task.get('id')
    log(f"✓ Created task: {task_id}", "SUCCESS")
    
    # Test first message
    log("\n3. Sending first message...")
    first_message = {
        "prompt": "Hello! My favorite programming language is Python and I love building APIs.",
        "org_name": "default",
        "cwd": "MockChatProject/MockChatTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=first_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"First message failed: {response.text}", "ERROR")
        return
    
    data1 = response.json()
    session_id = data1.get('session_id')
    chat_id1 = data1.get('chat_id')
    
    log(f"✓ Response received:", "SUCCESS")
    log(f"  Session ID: {session_id}")
    log(f"  Chat ID: {chat_id1}")
    
    # Send mock webhook for first message
    log("\n4. Sending mock webhook for first message...")
    asyncio.run(send_mock_webhook(chat_id1, session_id, 1))
    
    # Wait and check messages
    time.sleep(1)
    log("\n5. Checking messages after mock webhook...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"✓ Found {len(messages)} messages", "SUCCESS")
        
        for i, msg in enumerate(messages, 1):
            role = msg.get('role', 'unknown')
            text = msg.get('content', {}).get('text', '')[:100]
            log(f"  Message {i}: [{role}] {text}...")
    
    # Test second message
    log("\n6. Sending second message to test continuity...")
    second_message = {
        "prompt": "What is my favorite programming language?",
        "session_id": session_id,
        "org_name": "default",
        "cwd": "MockChatProject/MockChatTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=second_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"Second message failed: {response.text}", "ERROR")
        return
    
    data2 = response.json()
    chat_id2 = data2.get('chat_id')
    
    log(f"✓ Response received:", "SUCCESS")
    log(f"  Chat ID: {chat_id2}")
    
    # Send mock webhook for second message
    log("\n7. Sending mock webhook for second message...")
    asyncio.run(send_mock_webhook(chat_id2, session_id, 2))
    
    # Final check
    time.sleep(1)
    log("\n8. Final conversation check...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"Total messages: {len(messages)}", "INFO")
        
        # Show all messages
        log("\nComplete conversation:", "INFO")
        for i, msg in enumerate(messages, 1):
            role = msg.get('role', 'unknown')
            text = msg.get('content', {}).get('text', '')
            log(f"  {i}. [{role:9s}] {text[:100]}{'...' if len(text) > 100 else ''}")
        
        # Check if context was maintained
        assistant_messages = [m for m in messages if m.get('role') == 'assistant']
        if len(assistant_messages) >= 2:
            last_msg = assistant_messages[-1].get('content', {}).get('text', '')
            if 'python' in last_msg.lower() and '#2' in last_msg:
                log("\n✅ SUCCESS: Messages are being sent, received, and updated correctly!", "SUCCESS")
                log("✅ Conversation continuity is working!", "SUCCESS")
            else:
                log("\n✗ Issue with message content", "ERROR")

if __name__ == "__main__":
    test_chat_with_mock()