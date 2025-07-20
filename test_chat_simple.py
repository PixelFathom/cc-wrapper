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

def test_chat_flow():
    """Test complete chat flow"""
    log("=" * 80)
    log("TESTING CHAT MESSAGE SENDING AND RECEIVING")
    log("=" * 80)
    
    # Create test project and task
    log("\n1. Creating test project...")
    project_data = {
        "name": "ChatTestProject",
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
        "name": "ChatTestTask",
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
    log("\n3. Sending first message without session_id...")
    first_message = {
        "prompt": "Hello! I am testing the chat system. My favorite programming language is Python and I love building APIs.",
        "org_name": "default",
        "cwd": "ChatTestProject/ChatTestTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=first_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"First message failed: {response.text}", "ERROR")
        log("\nDebugging: Checking if Claude Code CLI is available...", "DEBUG")
        
        # Try to check webhook endpoint
        test_webhook = requests.get("http://localhost:9090/health")
        log(f"Webhook endpoint health check: {test_webhook.status_code if test_webhook.status_code else 'Failed'}", "DEBUG")
        return
    
    data1 = response.json()
    session_id = data1.get('session_id')
    chat_id1 = data1.get('chat_id')
    assistant_response1 = data1.get('assistant_response', '')
    
    log(f"✓ Response received:", "SUCCESS")
    log(f"  Session ID: {session_id}")
    log(f"  Chat ID: {chat_id1}")
    log(f"  Assistant: {assistant_response1[:100]}...")
    
    # Wait for processing
    log("\n4. Waiting for message processing...")
    time.sleep(3)
    
    # Check chat messages
    log("\n5. Fetching chat messages...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"✓ Found {len(messages)} messages in session", "SUCCESS")
        
        for i, msg in enumerate(messages, 1):
            role = msg.get('role', 'unknown')
            text = msg.get('content', {}).get('text', '')[:80]
            log(f"  Message {i}: [{role}] {text}...")
            
            # Check if assistant message was updated
            if role == 'assistant' and 'Processing your request' not in text:
                log(f"  ✓ Assistant message was updated!", "SUCCESS")
    else:
        log(f"Failed to fetch messages: {response.status_code}", "ERROR")
    
    # Check hooks
    log("\n6. Checking message hooks...")
    if chat_id1:
        response = requests.get(f"{BASE_URL}/chats/{chat_id1}/hooks")
        if response.status_code == 200:
            hooks_data = response.json()
            hooks = hooks_data.get('hooks', [])
            log(f"✓ Found {len(hooks)} hooks", "SUCCESS")
            
            for hook in hooks[:5]:
                status = hook.get('status', 'unknown')
                step_name = hook.get('step_name', hook.get('hook_type', 'unknown'))
                log(f"  Hook: [{status}] {step_name}")
        else:
            log(f"Failed to fetch hooks: {response.status_code}", "ERROR")
    
    # Test second message with session continuity
    log("\n7. Testing conversation continuity...")
    log(f"   Using session_id: {session_id}")
    
    second_message = {
        "prompt": "What is my favorite programming language? Please recall from our conversation.",
        "session_id": session_id,
        "org_name": "default",
        "cwd": "ChatTestProject/ChatTestTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=second_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"Second message failed: {response.text}", "ERROR")
        return
    
    data2 = response.json()
    chat_id2 = data2.get('chat_id')
    assistant_response2 = data2.get('assistant_response', '')
    returned_session_id = data2.get('session_id')
    
    log(f"✓ Response received:", "SUCCESS")
    log(f"  Returned Session ID: {returned_session_id}")
    log(f"  Chat ID: {chat_id2}")
    log(f"  Assistant: {assistant_response2[:100]}...")
    
    # Verify session continuity
    if returned_session_id == session_id:
        log("✓ Session ID maintained correctly!", "SUCCESS")
    else:
        log(f"✗ Session ID changed! Expected: {session_id}, Got: {returned_session_id}", "ERROR")
    
    # Wait and check final state
    log("\n8. Waiting for final processing...")
    time.sleep(3)
    
    # Check all messages again
    log("\n9. Final conversation check...")
    response = requests.get(f"{BASE_URL}/chats/session/{session_id}")
    
    if response.status_code == 200:
        messages = response.json().get('messages', [])
        log(f"Total messages in conversation: {len(messages)}", "INFO")
        
        # Count message types
        user_msgs = sum(1 for m in messages if m.get('role') == 'user')
        assistant_msgs = sum(1 for m in messages if m.get('role') == 'assistant')
        
        log(f"  User messages: {user_msgs}")
        log(f"  Assistant messages: {assistant_msgs}")
        
        # Check if context was maintained
        assistant_messages = [m for m in messages if m.get('role') == 'assistant']
        if len(assistant_messages) >= 2:
            last_msg = assistant_messages[-1].get('content', {}).get('text', '')
            if 'python' in last_msg.lower():
                log("\n✅ SUCCESS: Conversation continuity verified! Assistant remembered Python!", "SUCCESS")
            else:
                log("\n✗ FAILED: Assistant did not remember the context", "ERROR")
                log(f"  Last assistant message: {last_msg[:150]}...", "DEBUG")
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    log("1. Message sending: ✓ Working")
    log("2. Message receiving: ✓ Working") 
    log("3. Session continuity: " + ("✓ Working" if returned_session_id == session_id else "✗ Failed"))
    log("4. Context retention: Check messages above")

if __name__ == "__main__":
    test_chat_flow()