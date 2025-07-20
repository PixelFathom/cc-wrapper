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

def test_webhook_session_handling():
    """Test that subsequent messages use session_id from completed webhook"""
    log("=" * 80)
    log("TESTING WEBHOOK SESSION ID HANDLING")
    log("=" * 80)
    
    # Create test project and task
    log("\n1. Creating test project...")
    project_data = {
        "name": "WebhookSessionTest",
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
        "name": "WebhookSessionTask",
        "project_id": project_id
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=task_data)
    if response.status_code not in [200, 201]:
        log(f"Failed to create task: {response.status_code} - {response.text}", "ERROR")
        return
    
    task = response.json()
    task_id = task.get('id')
    log(f"✓ Created task: {task_id}", "SUCCESS")
    
    # Test 1: First message (no session_id)
    log("\n3. Sending first message without session_id...")
    first_message = {
        "prompt": "Hello! Remember that I love Python.",
        "org_name": "default",
        "cwd": "WebhookSessionTest/WebhookSessionTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=first_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"First message failed: {response.text}", "ERROR")
        return
    
    data1 = response.json()
    original_session_id = data1.get('session_id')
    chat_id1 = data1.get('chat_id')
    
    log(f"✓ First message sent:", "SUCCESS")
    log(f"  Original Session ID: {original_session_id}")
    log(f"  Chat ID: {chat_id1}")
    
    # Simulate a completed webhook with a different session_id
    log("\n4. Simulating completed webhook with different session_id...")
    webhook_session_id = f"webhook-{original_session_id}"  # Different session ID
    
    webhook_data = {
        "type": "processing",
        "status": "completed",
        "result": "I've noted that you love Python!",
        "task_id": f"test-task-{chat_id1}",
        "session_id": webhook_session_id,  # Different session ID from webhook
        "conversation_id": chat_id1,
        "timestamp": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/webhooks/chat/{chat_id1}", json=webhook_data)
    if response.status_code == 200:
        log(f"✓ Webhook sent with session_id: {webhook_session_id}", "SUCCESS")
    else:
        log(f"Webhook failed: {response.status_code}", "ERROR")
    
    # Wait for webhook processing
    time.sleep(2)
    
    # Check hooks to verify webhook session_id was stored
    log("\n5. Verifying webhook session_id was stored...")
    response = requests.get(f"{BASE_URL}/chats/{chat_id1}/hooks")
    
    if response.status_code == 200:
        hooks_data = response.json()
        hooks = hooks_data.get('hooks', [])
        
        completed_hook = None
        for hook in hooks:
            if hook.get('status') == 'completed':
                completed_hook = hook
                break
        
        if completed_hook:
            stored_session_id = completed_hook.get('data', {}).get('session_id')
            log(f"✓ Found completed hook with session_id: {stored_session_id}", "SUCCESS")
        else:
            log("✗ No completed hook found", "ERROR")
    
    # Test 2: Second message with original session_id
    log(f"\n6. Sending second message with original session_id: {original_session_id}")
    second_message = {
        "prompt": "What programming language do I love?",
        "session_id": original_session_id,  # Using original session ID
        "org_name": "default",
        "cwd": "WebhookSessionTest/WebhookSessionTask/sub1"
    }
    
    response = requests.post(f"{BASE_URL}/query", json=second_message)
    log(f"Response status: {response.status_code}")
    
    if response.status_code != 200:
        log(f"Second message failed: {response.text}", "ERROR")
        return
    
    data2 = response.json()
    chat_id2 = data2.get('chat_id')
    
    log(f"✓ Second message sent:", "SUCCESS")
    log(f"  Chat ID: {chat_id2}")
    
    # Check backend logs to see if webhook session_id was used
    log("\n7. Checking if webhook session_id was used...")
    log("  (Check backend logs for '✅ Found completed webhook session_id' message)")
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    log(f"1. Original session_id: {original_session_id}")
    log(f"2. Webhook session_id: {webhook_session_id}")
    log("3. Expected behavior: Second message should use webhook session_id")
    log("4. Check backend logs to verify session_id handling")

if __name__ == "__main__":
    test_webhook_session_handling()