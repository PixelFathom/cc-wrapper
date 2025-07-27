#!/usr/bin/env python3
"""
Comprehensive Session ID Fix Test

This script specifically tests the issue where:
1. A new message is sent to an existing conversation
2. Assistant reply initially shows "in progress" with correct session_id
3. During webhook processing, the session_id gets updated 
4. This creates a new conversation instead of updating the existing one

The fix should ensure that:
- The assistant message maintains the same session_id throughout its lifecycle
- Webhook session_ids are stored in metadata, not used to update the UI session_id
- No new conversations are created when they should be continuations
"""

import asyncio
import json
import aiohttp
import uuid
import time
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8000"

async def wait_for_completion(session: aiohttp.ClientSession, chat_id: str, max_wait: int = 30):
    """Wait for a chat message to complete processing"""
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        async with session.get(f"{BASE_URL}/api/messages/{chat_id}/hooks") as response:
            if response.status == 200:
                data = await response.json()
                hooks = data.get("hooks", [])
                
                # Check if there are any completed hooks
                for hook in hooks:
                    if hook.get("status") == "completed" or hook.get("is_complete"):
                        return True
                        
        await asyncio.sleep(1)
    
    return False

async def get_session_messages(session: aiohttp.ClientSession, session_id: str):
    """Get all messages for a session"""
    async with session.get(f"{BASE_URL}/api/chats/session/{session_id}") as response:
        if response.status == 200:
            data = await response.json()
            return data.get("messages", [])
        return []

async def test_in_progress_session_preservation():
    """Test the specific issue with in-progress messages and session ID changes"""
    print("🔍 Testing In-Progress Session ID Preservation Fix")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        # Initialize a project first
        project_name = f"inprogress-test-{uuid.uuid4().hex[:8]}"
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
            print(f"✅ Project initialized: {project_data}")
        
        # Session tracking
        session_states = []
        
        # Step 1: Send first message to establish conversation
        print(f"\n📝 Step 1: Establishing conversation with first message")
        payload1 = {
            "prompt": "Please write a simple Python function that calculates the factorial of a number. Make sure to include proper error handling.",
            "org_name": "default", 
            "cwd": cwd
        }
        
        print(f"📤 Sending first query...")
        async with session.post(f"{BASE_URL}/api/query", json=payload1) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"First query failed {response.status}: {text}")
                
            response1 = await response.json()
            established_session_id = response1.get("session_id")
            assistant_chat_id = response1.get("assistant_chat_id")
            
            if not established_session_id:
                raise Exception("❌ First response did not provide session_id")
            
            session_states.append({
                "step": "Initial conversation",
                "session_id": established_session_id,
                "assistant_chat_id": assistant_chat_id,
                "time": time.time()
            })
            
            print(f"✅ Established session ID: {established_session_id}")
            print(f"✅ Assistant message ID: {assistant_chat_id}")
        
        # Wait for first message to complete
        print(f"⏳ Waiting for first message to complete...")
        completed = await wait_for_completion(session, assistant_chat_id, max_wait=60)
        if not completed:
            print("⚠️ First message may not have completed, continuing anyway...")
        else:
            print("✅ First message completed")
        
        # Check session messages after first completion
        messages_after_first = await get_session_messages(session, established_session_id)
        print(f"📊 Messages in session after first: {len(messages_after_first)}")
        
        # Step 2: Send second message - THIS IS WHERE THE BUG OCCURS
        print(f"\n📝 Step 2: Sending continuation message (testing session preservation)")
        payload2 = {
            "prompt": "Now please modify that function to also calculate the factorial iteratively and compare the performance of both approaches.",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": established_session_id  # Use established session ID
        }
        
        print(f"📤 Sending continuation query with session_id: {established_session_id}")
        async with session.post(f"{BASE_URL}/api/query", json=payload2) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Second query failed {response.status}: {text}")
                
            response2 = await response.json()
            response2_session_id = response2.get("session_id")
            assistant_chat_id_2 = response2.get("assistant_chat_id")
            
            session_states.append({
                "step": "Continuation response (initial)",
                "session_id": response2_session_id,
                "assistant_chat_id": assistant_chat_id_2,
                "time": time.time()
            })
            
            print(f"📥 Response session ID: {response2_session_id}")
            print(f"📥 Assistant message ID: {assistant_chat_id_2}")
            
            # CRITICAL TEST: Verify session ID is preserved in response
            if response2_session_id != established_session_id:
                print(f"❌ CRITICAL FAILURE: Session ID changed in API response!")
                print(f"   Expected: {established_session_id}")
                print(f"   Got:      {response2_session_id}")
                return False
            else:
                print(f"✅ API response preserved session ID")
        
        # Step 3: Check session immediately after second message (before webhooks complete)
        print(f"\n📝 Step 3: Checking session state during processing")
        messages_during_processing = await get_session_messages(session, established_session_id)
        print(f"📊 Messages in session during processing: {len(messages_during_processing)}")
        
        # Look for the in-progress assistant message
        in_progress_assistant = None
        for msg in messages_during_processing:
            if msg.get("role") == "assistant" and msg.get("id") == assistant_chat_id_2:
                in_progress_assistant = msg
                break
        
        if in_progress_assistant:
            in_progress_session_id = in_progress_assistant.get("session_id")
            print(f"📋 In-progress assistant message session_id: {in_progress_session_id}")
            
            # CRITICAL TEST: In-progress message should have correct session ID
            if in_progress_session_id != established_session_id:
                print(f"❌ CRITICAL FAILURE: In-progress message has wrong session ID!")
                print(f"   Expected: {established_session_id}")
                print(f"   Got:      {in_progress_session_id}")
                return False
            else:
                print(f"✅ In-progress message has correct session ID")
        else:
            print(f"⚠️ Could not find in-progress assistant message")
        
        # Step 4: Wait for completion and check final state
        print(f"\n📝 Step 4: Waiting for completion and checking final state")
        print(f"⏳ Waiting for second message to complete...")
        completed = await wait_for_completion(session, assistant_chat_id_2, max_wait=60)
        
        if not completed:
            print("⚠️ Second message may not have completed")
        else:
            print("✅ Second message completed")
        
        # Check final session state
        final_messages = await get_session_messages(session, established_session_id)
        print(f"📊 Final messages in session: {len(final_messages)}")
        
        # Find the completed assistant message
        completed_assistant = None
        for msg in final_messages:
            if msg.get("role") == "assistant" and msg.get("id") == assistant_chat_id_2:
                completed_assistant = msg
                break
        
        if completed_assistant:
            final_session_id = completed_assistant.get("session_id")
            print(f"📋 Completed assistant message session_id: {final_session_id}")
            
            # CRITICAL TEST: Completed message should STILL have correct session ID
            if final_session_id != established_session_id:
                print(f"❌ CRITICAL FAILURE: Completed message session ID was changed by webhooks!")
                print(f"   Expected: {established_session_id}")
                print(f"   Got:      {final_session_id}")
                print(f"   This is the bug - webhooks updated the session_id creating a new conversation!")
                return False
            else:
                print(f"✅ Completed message preserved session ID")
        
        # Step 5: Verify no new conversations were created
        print(f"\n📝 Step 5: Verifying conversation integrity")
        
        # Check if we accidentally created messages in a different session
        if completed_assistant and completed_assistant.get("session_id") != established_session_id:
            wrong_session_id = completed_assistant.get("session_id")
            wrong_session_messages = await get_session_messages(session, wrong_session_id)
            print(f"❌ Found {len(wrong_session_messages)} messages in wrong session: {wrong_session_id}")
            
            print(f"\n📋 Wrong session messages:")
            for i, msg in enumerate(wrong_session_messages):
                print(f"   {i+1}. {msg.get('role')}: {msg.get('content', {}).get('text', '')[:50]}...")
        
        # Final verification
        print(f"\n📊 Test Summary:")
        print(f"   Project: {project_name}")
        print(f"   Task: {task_name}")
        print(f"   Established session ID: {established_session_id}")
        print(f"   Total messages in main session: {len(final_messages)}")
        
        # Check all session IDs in final messages
        session_ids_in_messages = set()
        for msg in final_messages:
            session_ids_in_messages.add(msg.get("session_id"))
        
        print(f"   Unique session IDs in conversation: {len(session_ids_in_messages)}")
        print(f"   Session IDs: {list(session_ids_in_messages)}")
        
        # Success conditions:
        # 1. Only one session ID should exist in the conversation
        # 2. All messages should use the established session ID
        # 3. Should have at least 4 messages (2 user, 2 assistant)
        
        success = (
            len(session_ids_in_messages) == 1 and
            established_session_id in session_ids_in_messages and
            len(final_messages) >= 4
        )
        
        if success:
            print("\n🎉 SUCCESS: Session ID preservation fix is working correctly!")
            print("   ✅ No new conversations were created")
            print("   ✅ Assistant messages maintained correct session ID throughout their lifecycle")
            print("   ✅ Webhooks did not corrupt the UI session ID")
            print("   ✅ Conversation continuity is preserved")
            return True
        else:
            print(f"\n❌ FAILURE: Session ID preservation has issues")
            if len(session_ids_in_messages) > 1:
                print(f"   ❌ Multiple session IDs found - new conversations were created")
            if len(final_messages) < 4:
                print(f"   ❌ Missing messages - expected at least 4, got {len(final_messages)}")
            return False

async def main():
    try:
        success = await test_in_progress_session_preservation()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())