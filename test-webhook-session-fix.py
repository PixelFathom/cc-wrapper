#!/usr/bin/env python3
"""
Webhook Session ID Fix Test

This test specifically focuses on the webhook processing issue where
session IDs get updated during webhook processing, creating new conversations.
"""

import asyncio
import json
import aiohttp
import uuid
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

async def test_webhook_session_preservation():
    """Test that webhooks don't corrupt session IDs"""
    print("🔍 Testing Webhook Session ID Preservation")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        # Initialize project
        project_name = f"webhook-test-{uuid.uuid4().hex[:8]}"
        task_name = f"task-{uuid.uuid4().hex[:8]}"
        cwd = f"{project_name}/{task_name}"
        
        print(f"🏗️ Initializing project: {cwd}")
        
        init_payload = {
            "org_name": "default",
            "cwd": cwd,
            "repo_url": "git@github.com:PixelFathom/session-test.git"
        }
        
        async with session.post(f"{BASE_URL}/api/init_project", json=init_payload) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Init project failed {response.status}: {text}")
            project_data = await response.json()
            print(f"✅ Project initialized")
        
        # Send first message
        print(f"\n📝 Step 1: Send first message")
        payload1 = {
            "prompt": "Hello, this is a test message to establish a conversation.",
            "org_name": "default", 
            "cwd": cwd
        }
        
        async with session.post(f"{BASE_URL}/api/query", json=payload1) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"First query failed {response.status}: {text}")
            
            response1 = await response.json()
            session_id = response1.get("session_id")
            assistant_chat_id = response1.get("assistant_chat_id")
            
            print(f"✅ Established session: {session_id}")
            print(f"✅ Assistant message: {assistant_chat_id}")
        
        # Immediately check the assistant message state
        print(f"\n📝 Step 2: Check initial assistant message state")
        async with session.get(f"{BASE_URL}/api/chats/session/{session_id}") as response:
            if response.status == 200:
                data = await response.json()
                messages = data.get("messages", [])
                
                assistant_messages = [m for m in messages if m.get("role") == "assistant"]
                if assistant_messages:
                    initial_assistant = assistant_messages[0]
                    initial_session_id = initial_assistant.get("session_id")
                    print(f"📋 Initial assistant session_id: {initial_session_id}")
                    
                    if initial_session_id != session_id:
                        print(f"❌ IMMEDIATE FAILURE: Assistant message has wrong session_id!")
                        return False
                    else:
                        print(f"✅ Initial assistant message has correct session_id")
        
        # Send second message to trigger continuation processing
        print(f"\n📝 Step 3: Send continuation message")
        payload2 = {
            "prompt": "Please elaborate on your previous response.",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": session_id
        }
        
        async with session.post(f"{BASE_URL}/api/query", json=payload2) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Second query failed {response.status}: {text}")
            
            response2 = await response.json()
            response_session_id = response2.get("session_id")
            assistant_chat_id_2 = response2.get("assistant_chat_id")
            
            print(f"📥 Response session_id: {response_session_id}")
            
            if response_session_id != session_id:
                print(f"❌ API LEVEL FAILURE: Response changed session_id!")
                return False
            else:
                print(f"✅ API response preserved session_id")
        
        # Check session state immediately after second request
        print(f"\n📝 Step 4: Check session state after continuation")
        async with session.get(f"{BASE_URL}/api/chats/session/{session_id}") as response:
            if response.status == 200:
                data = await response.json()
                messages = data.get("messages", [])
                
                print(f"📊 Total messages in session: {len(messages)}")
                
                # Check all session IDs
                session_ids_found = set()
                for msg in messages:
                    msg_session_id = msg.get("session_id")
                    session_ids_found.add(msg_session_id)
                    
                    if msg_session_id != session_id:
                        print(f"❌ FOUND WRONG SESSION ID: {msg.get('role')} message has session_id {msg_session_id}")
                        print(f"   Message ID: {msg.get('id')}")
                        print(f"   Content: {msg.get('content', {}).get('text', '')[:50]}...")
                
                print(f"📋 Unique session IDs found: {len(session_ids_found)}")
                print(f"📋 Session IDs: {list(session_ids_found)}")
                
                if len(session_ids_found) == 1 and session_id in session_ids_found:
                    print(f"✅ All messages have correct session_id")
                    return True
                else:
                    print(f"❌ Session ID corruption detected!")
                    return False
        
        return False

async def main():
    try:
        success = await test_webhook_session_preservation()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())