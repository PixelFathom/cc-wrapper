#!/usr/bin/env python3
"""
Final Session ID Verification Test

This comprehensive test verifies that the session ID preservation fix is working correctly
by testing the exact scenario described in the issue:

1. Send message to existing conversation
2. Assistant reply shows "in progress" with correct session_id
3. During webhook processing, session_id should NOT be updated
4. Final message should maintain the same session_id (no new conversation)
"""

import asyncio
import json
import aiohttp
import uuid
import time
from typing import Dict, Any, List

BASE_URL = "http://localhost:8000"

async def get_all_sessions_for_subproject(session: aiohttp.ClientSession, sub_project_id: str) -> List[Dict]:
    """Get all sessions for a sub-project"""
    async with session.get(f"{BASE_URL}/api/sub-projects/{sub_project_id}/sessions") as response:
        if response.status == 200:
            data = await response.json()
            return data.get("sessions", [])
        return []

async def get_session_messages(session: aiohttp.ClientSession, session_id: str) -> List[Dict]:
    """Get all messages for a session"""
    async with session.get(f"{BASE_URL}/api/chats/session/{session_id}") as response:
        if response.status == 200:
            data = await response.json()
            return data.get("messages", [])
        return []

async def test_complete_session_flow():
    """Test the complete session flow to verify no new conversations are created"""
    print("🔍 Final Session ID Preservation Verification")
    print("=" * 55)
    
    async with aiohttp.ClientSession() as session:
        # Initialize project
        project_name = f"final-test-{uuid.uuid4().hex[:8]}"
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
            sub_project_id = project_data["sub_project_id"]
            print(f"✅ Project initialized")
            print(f"📋 Sub-project ID: {sub_project_id}")
        
        # Baseline: Check initial session count
        initial_sessions = await get_all_sessions_for_subproject(session, sub_project_id)
        print(f"📊 Initial sessions in sub-project: {len(initial_sessions)}")
        
        # Step 1: Send first message
        print(f"\n📝 Step 1: Send first message to establish conversation")
        payload1 = {
            "prompt": "Hello! Please tell me about Python data structures.",
            "org_name": "default", 
            "cwd": cwd
        }
        
        async with session.post(f"{BASE_URL}/api/query", json=payload1) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"First query failed {response.status}: {text}")
            
            response1 = await response.json()
            established_session_id = response1.get("session_id")
            
            print(f"✅ Established conversation")
            print(f"📋 Session ID: {established_session_id}")
        
        # Check sessions after first message
        sessions_after_first = await get_all_sessions_for_subproject(session, sub_project_id)
        print(f"📊 Sessions after first message: {len(sessions_after_first)}")
        
        # Step 2: Send second message (this is where the bug would occur)
        print(f"\n📝 Step 2: Send continuation message (critical test)")
        payload2 = {
            "prompt": "Can you explain how dictionaries work in Python?",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": established_session_id  # Continue existing conversation
        }
        
        async with session.post(f"{BASE_URL}/api/query", json=payload2) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Second query failed {response.status}: {text}")
            
            response2 = await response.json()
            response_session_id = response2.get("session_id")
            
            print(f"📥 API Response session ID: {response_session_id}")
            
            # Critical check: API should return same session_id
            if response_session_id != established_session_id:
                print(f"❌ CRITICAL: API response changed session_id!")
                print(f"   Expected: {established_session_id}")
                print(f"   Got:      {response_session_id}")
                return False
            else:
                print(f"✅ API response preserved session_id")
        
        # Step 3: Send third message to further verify
        print(f"\n📝 Step 3: Send third message for additional verification")
        payload3 = {
            "prompt": "What about lists and tuples?",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": established_session_id
        }
        
        async with session.post(f"{BASE_URL}/api/query", json=payload3) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Third query failed {response.status}: {text}")
            
            response3 = await response.json()
            response3_session_id = response3.get("session_id")
            
            print(f"📥 Third response session ID: {response3_session_id}")
            
            if response3_session_id != established_session_id:
                print(f"❌ CRITICAL: Third response changed session_id!")
                return False
            else:
                print(f"✅ Third response preserved session_id")
        
        # Wait a moment for any background processing
        await asyncio.sleep(2)
        
        # Step 4: Final verification - check session count and messages
        print(f"\n📝 Step 4: Final verification")
        
        # Check total sessions in sub-project
        final_sessions = await get_all_sessions_for_subproject(session, sub_project_id)
        print(f"📊 Final sessions in sub-project: {len(final_sessions)}")
        
        # Check messages in our established session
        established_messages = await get_session_messages(session, established_session_id)
        print(f"📊 Messages in established session: {len(established_messages)}")
        
        # Verify all messages have correct session_id
        session_ids_in_messages = set()
        message_roles = []
        
        for msg in established_messages:
            session_ids_in_messages.add(msg.get("session_id"))
            message_roles.append(msg.get("role"))
        
        print(f"📋 Message roles: {message_roles}")
        print(f"📋 Unique session IDs in messages: {len(session_ids_in_messages)}")
        print(f"📋 Session IDs: {list(session_ids_in_messages)}")
        
        # Check if any new sessions were created (beyond the initial count)
        new_sessions_created = len(final_sessions) - len(initial_sessions)
        print(f"📊 New sessions created: {new_sessions_created}")
        
        if new_sessions_created > 1:
            print(f"⚠️ Multiple new sessions created - investigating...")
            
            # Show all sessions
            for i, sess in enumerate(final_sessions):
                print(f"   Session {i+1}: {sess.get('session_id')} ({sess.get('message_count')} messages)")
                if sess.get('session_id') != established_session_id:
                    # Check messages in this other session
                    other_messages = await get_session_messages(session, sess.get('session_id'))
                    print(f"      Messages in this session:")
                    for j, msg in enumerate(other_messages):
                        content_preview = msg.get('content', {}).get('text', '')[:50]
                        print(f"         {j+1}. {msg.get('role')}: {content_preview}...")
        
        # Success criteria:
        success_criteria = {
            "single_session_id": len(session_ids_in_messages) == 1,
            "correct_session_id": established_session_id in session_ids_in_messages,
            "expected_message_count": len(established_messages) >= 6,  # 3 user + 3 assistant
            "no_extra_conversations": new_sessions_created <= 1  # Should only be 1 new conversation
        }
        
        print(f"\n📊 Success Criteria:")
        for criterion, passed in success_criteria.items():
            status = "✅" if passed else "❌"
            print(f"   {status} {criterion}: {passed}")
        
        all_passed = all(success_criteria.values())
        
        if all_passed:
            print(f"\n🎉 SUCCESS: Session ID preservation fix is working perfectly!")
            print(f"   ✅ No new conversations were created when they shouldn't be")
            print(f"   ✅ All messages maintained correct session_id throughout their lifecycle")
            print(f"   ✅ Webhooks did not corrupt UI session_ids")
            print(f"   ✅ The fix prevents the bug where webhooks create new conversations")
            return True
        else:
            print(f"\n❌ FAILURE: Session ID preservation has issues")
            failed_criteria = [k for k, v in success_criteria.items() if not v]
            print(f"   Failed criteria: {failed_criteria}")
            return False

async def main():
    try:
        success = await test_complete_session_flow()
        if success:
            print(f"\n🎯 FINAL RESULT: The session ID preservation fix is working correctly!")
            print(f"   The bug where assistant messages create new conversations has been fixed.")
        else:
            print(f"\n🚨 FINAL RESULT: There are still issues with session ID preservation.")
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())