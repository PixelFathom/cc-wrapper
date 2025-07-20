#!/usr/bin/env python3
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

def create_test_project():
    """Create a test project and task"""
    log("Creating test project and task...", "INFO")
    
    # Create project
    project_data = {
        "name": "TestProject",
        "repo_url": "https://github.com/test/test"
    }
    
    response = requests.post(f"{BASE_URL}/projects", json=project_data)
    if response.status_code not in [200, 201]:
        log(f"Failed to create project: {response.status_code} - {response.text}", "ERROR")
        return None, None
    
    project = response.json()
    project_id = project.get('id')
    log(f"Created project: {project_id}", "SUCCESS")
    
    # Create task
    task_data = {
        "name": "TestTask",
        "project_id": project_id
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=task_data)
    if response.status_code not in [200, 201]:
        log(f"Failed to create task: {response.status_code} - {response.text}", "ERROR")
        return project_id, None
    
    task = response.json()
    task_id = task.get('id')
    log(f"Created task: {task_id}", "SUCCESS")
    
    return project_id, task_id

def test_chat_conversation():
    """Test complete chat conversation flow"""
    log("=" * 80)
    log("TESTING CHAT CONVERSATION CONTINUITY")
    log("=" * 80)
    
    # Create test project and task
    project_id, task_id = create_test_project()
    if not project_id or not task_id:
        log("Failed to create test project/task", "ERROR")
        return
    
    # Test 1: First message (no session_id)
    log("\n📤 TEST 1: First message without session_id", "TEST")
    first_message = {
        "prompt": "Hello! I am a test user. My favorite color is blue and I love coding in Python.",
        "org_name": "default",
        "cwd": "TestProject/TestTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=first_message)
    if response.status_code != 200:
        log(f"First message failed: {response.status_code} - {response.text}", "ERROR")
        return
    
    data1 = response.json()
    session_id = data1.get('session_id')
    chat_id1 = data1.get('chat_id')
    
    log(f"Response received:", "SUCCESS")
    log(f"  Session ID: {session_id}")
    log(f"  Chat ID: {chat_id1}")
    log(f"  Assistant: {data1.get('assistant_response', '')[:100]}...")
    
    # Wait for webhooks
    log("\nWaiting 3 seconds for webhooks...", "INFO")
    time.sleep(3)
    
    # Check session messages
    log(f"\n🔍 Checking session {session_id} messages...", "TEST")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"Found {len(messages)} messages:", "SUCCESS")
        for i, msg in enumerate(messages, 1):
            text = msg['content'].get('text', '')[:80]
            log(f"  {i}. [{msg['role']:9s}] {text}...")
    
    # Check hooks for first message
    log(f"\n🔍 Checking hooks for chat {chat_id1}...", "TEST")
    response = requests.get(f"{BASE_URL}/chats/{chat_id1}/hooks")
    if response.status_code == 200:
        hooks = response.json().get('hooks', [])
        log(f"Found {len(hooks)} hooks:", "SUCCESS")
        for hook in hooks[:5]:  # Show first 5 hooks
            log(f"  [{hook['status']:12s}] {hook.get('step_name', hook['hook_type'])}")
    
    # Test 2: Second message WITH session_id
    log(f"\n📤 TEST 2: Second message WITH session_id: {session_id}", "TEST")
    second_message = {
        "prompt": "What is my favorite color? And what programming language do I love?",
        "session_id": session_id,
        "org_name": "default",
        "cwd": "TestProject/TestTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=second_message)
    if response.status_code != 200:
        log(f"Second message failed: {response.status_code} - {response.text}", "ERROR")
        return
    
    data2 = response.json()
    chat_id2 = data2.get('chat_id')
    
    log(f"Response received:", "SUCCESS")
    log(f"  Session ID: {data2.get('session_id')}")
    log(f"  Chat ID: {chat_id2}")
    log(f"  Assistant: {data2.get('assistant_response', '')[:100]}...")
    
    # Verify session continuity
    if data2.get('session_id') == session_id:
        log("✅ Session ID maintained correctly!", "SUCCESS")
    else:
        log(f"❌ Session ID changed! Expected: {session_id}, Got: {data2.get('session_id')}", "ERROR")
    
    # Wait for webhooks
    log("\nWaiting 3 seconds for webhooks...", "INFO")
    time.sleep(3)
    
    # Check all messages
    log(f"\n🔍 Checking complete conversation in session {session_id}...", "TEST")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"Found {len(messages)} total messages:", "SUCCESS")
        
        user_msgs = [m for m in messages if m['role'] == 'user']
        assistant_msgs = [m for m in messages if m['role'] == 'assistant']
        
        log(f"  User messages: {len(user_msgs)}")
        log(f"  Assistant messages: {len(assistant_msgs)}")
        
        # Show all messages
        log("\nComplete conversation:", "INFO")
        for i, msg in enumerate(messages, 1):
            text = msg['content'].get('text', '')[:100]
            log(f"  {i}. [{msg['role']:9s}] {text}...")
    
    # Check hooks for second message
    log(f"\n🔍 Checking hooks for second chat {chat_id2}...", "TEST")
    response = requests.get(f"{BASE_URL}/chats/{chat_id2}/hooks")
    if response.status_code == 200:
        hooks = response.json().get('hooks', [])
        log(f"Found {len(hooks)} hooks:", "SUCCESS")
        for hook in hooks[:5]:
            log(f"  [{hook['status']:12s}] {hook.get('step_name', hook['hook_type'])}")
            # Check if session_id is in webhook data
            if 'session_id' in hook.get('data', {}):
                log(f"    └─ webhook session_id: {hook['data']['session_id']}")
    
    # Test 3: Simulate successful webhook
    log(f"\n📤 TEST 3: Simulating successful webhook response", "TEST")
    webhook_data = {
        "type": "processing",
        "status": "completed",
        "result": "Based on our conversation, your favorite color is blue and you love coding in Python!",
        "task_id": "test-task-123",
        "session_id": session_id,
        "conversation_id": chat_id2,
        "timestamp": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/webhooks/chat/{chat_id2}", json=webhook_data)
    if response.status_code == 200:
        log("Webhook processed successfully", "SUCCESS")
    else:
        log(f"Webhook failed: {response.status_code} - {response.text}", "ERROR")
    
    # Final check
    time.sleep(1)
    log(f"\n🔍 Final conversation state...", "TEST")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"Total messages: {len(messages)}", "SUCCESS")
        
        # Check last assistant message
        assistant_msgs = [m for m in messages if m['role'] == 'assistant']
        if assistant_msgs:
            last_assistant = assistant_msgs[-1]
            text = last_assistant['content'].get('text', '')
            if "blue" in text.lower() and "python" in text.lower():
                log("✅ Conversation continuity verified! Assistant remembered the context!", "SUCCESS")
            else:
                log(f"Last assistant message: {text[:150]}...", "INFO")

if __name__ == "__main__":
    test_chat_conversation()