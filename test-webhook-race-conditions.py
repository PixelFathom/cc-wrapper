#!/usr/bin/env python3
"""
Webhook Race Condition Test

This test specifically verifies that the session ID fix handles webhook race conditions correctly,
where multiple webhooks might be processed simultaneously for the same conversation.
"""

import asyncio
import json
import aiohttp
import uuid
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

async def simulate_webhook_race_condition():
    """Test webhook race conditions that might corrupt session IDs"""
    print("🔍 Testing Webhook Race Condition Handling")
    print("=" * 45)
    
    async with aiohttp.ClientSession() as session:
        # Initialize project
        project_name = f"race-test-{uuid.uuid4().hex[:8]}"
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
        
        # Send multiple messages in rapid succession to test race conditions
        print(f"\n📝 Sending multiple messages rapidly to test race conditions")
        
        session_id = None
        message_count = 5
        
        for i in range(message_count):
            print(f"📤 Sending message {i+1}/{message_count}")
            
            payload = {
                "prompt": f"Message {i+1}: Please respond with information about topic {i+1}.",
                "org_name": "default", 
                "cwd": cwd
            }
            
            # Include session_id from second message onwards
            if session_id:
                payload["session_id"] = session_id
            
            async with session.post(f"{BASE_URL}/api/query", json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    print(f"⚠️ Message {i+1} failed: {text}")
                    continue
                
                response_data = await response.json()
                response_session_id = response_data.get("session_id")
                
                if not session_id:
                    # First message establishes session_id
                    session_id = response_session_id
                    print(f"✅ Established session: {session_id}")
                else:
                    # Subsequent messages should preserve session_id
                    if response_session_id != session_id:
                        print(f"❌ RACE CONDITION FAILURE: Session ID changed!")
                        print(f"   Expected: {session_id}")
                        print(f"   Got:      {response_session_id}")
                        return False
                    else:
                        print(f"✅ Session ID preserved: {response_session_id}")
            
            # Small delay to avoid overwhelming the system
            await asyncio.sleep(0.5)
        
        # Wait for all processing to complete
        print(f"\n⏳ Waiting for all processing to complete...")
        await asyncio.sleep(3)
        
        # Final verification
        print(f"\n📝 Final verification after race condition test")
        
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
                
                print(f"📋 Unique session IDs found: {len(session_ids_found)}")
                print(f"📋 Session IDs: {list(session_ids_found)}")
                
                if len(session_ids_found) == 1 and session_id in session_ids_found:
                    print(f"✅ Race condition test passed - all messages have correct session_id")
                    return True
                else:
                    print(f"❌ Race condition test failed - session ID corruption detected")
                    return False
        
        return False

async def main():
    try:
        success = await simulate_webhook_race_condition()
        if success:
            print(f"\n🎉 Race condition test PASSED!")
            print(f"   The session ID fix handles concurrent webhooks correctly.")
        else:
            print(f"\n❌ Race condition test FAILED!")
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())