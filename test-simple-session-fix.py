#!/usr/bin/env python3
"""
Simple Session ID Fix Test

This script tests the session ID preservation fix by initializing a project
and then testing session ID continuity.
"""

import asyncio
import json
import aiohttp
import uuid
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8000"

async def test_session_preservation():
    """Test that session IDs are preserved correctly"""
    print("🧪 Testing Session ID Preservation Fix")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        # Initialize a project first
        project_name = f"session-test-{uuid.uuid4().hex[:8]}"
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
        
        # Track session flow
        session_log = []
        
        # Test 1: First message (should establish session ID)
        print(f"\n📝 Test 1: First message")
        payload1 = {
            "prompt": "Hello, this is my first test message to verify session ID preservation",
            "org_name": "default", 
            "cwd": cwd
        }
        
        print(f"📤 Sending first query (no session_id)...")
        async with session.post(f"{BASE_URL}/api/query", json=payload1) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"First query failed {response.status}: {text}")
                
            response1 = await response.json()
            session_id = response1.get("session_id")
            
            if not session_id:
                raise Exception("❌ First response did not provide session_id")
                
            session_log.append({
                "message": "First message",
                "request_session_id": None,
                "response_session_id": session_id
            })
            
            print(f"✅ Established session ID: {session_id}")
        
        # Test 2: Second message (should use same session ID)
        print(f"\n📝 Test 2: Second message (testing session preservation)")
        payload2 = {
            "prompt": "This is my second message to test session continuity",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": session_id  # Include session_id for continuation
        }
        
        print(f"📤 Sending second query (session_id: {session_id})...")
        async with session.post(f"{BASE_URL}/api/query", json=payload2) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Second query failed {response.status}: {text}")
                
            response2 = await response.json()
            response2_session_id = response2.get("session_id")
            
            session_log.append({
                "message": "Second message",
                "request_session_id": session_id,
                "response_session_id": response2_session_id
            })
            
            print(f"📥 Response session ID: {response2_session_id}")
            
            # CRITICAL TEST: Verify session ID is preserved
            if response2_session_id != session_id:
                print(f"❌ FAILURE: Session ID changed!")
                print(f"   Expected: {session_id}")
                print(f"   Got:      {response2_session_id}")
                return False
            else:
                print(f"✅ Session ID preserved: {response2_session_id}")
        
        # Test 3: Third message (final verification)
        print(f"\n📝 Test 3: Third message (final verification)")
        payload3 = {
            "prompt": "Third message for final session verification",
            "org_name": "default", 
            "cwd": cwd,
            "session_id": session_id
        }
        
        print(f"📤 Sending third query (session_id: {session_id})...")
        async with session.post(f"{BASE_URL}/api/query", json=payload3) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"Third query failed {response.status}: {text}")
                
            response3 = await response.json()
            response3_session_id = response3.get("session_id")
            
            session_log.append({
                "message": "Third message",
                "request_session_id": session_id,
                "response_session_id": response3_session_id
            })
            
            print(f"📥 Response session ID: {response3_session_id}")
            
            if response3_session_id != session_id:
                print(f"❌ FAILURE: Session ID changed!")
                print(f"   Expected: {session_id}")
                print(f"   Got:      {response3_session_id}")
                return False
            else:
                print(f"✅ Session ID preserved: {response3_session_id}")
        
        # Summary
        print("\n📊 Test Summary:")
        print(f"   Project: {project_name}")
        print(f"   Task: {task_name}")
        print(f"   Session ID: {session_id}")
        print(f"   Total API calls: {len(session_log)}")
        
        all_response_sessions = [log["response_session_id"] for log in session_log]
        unique_sessions = set(all_response_sessions)
        
        print(f"   Unique session IDs in responses: {len(unique_sessions)}")
        print(f"   Session IDs: {list(unique_sessions)}")
        
        print("\n📋 Detailed Session Log:")
        for i, log in enumerate(session_log, 1):
            print(f"   {i}. {log['message']}")
            print(f"      Request session_id:  {log['request_session_id'] or 'None'}")
            print(f"      Response session_id: {log['response_session_id']}")
        
        if len(unique_sessions) == 1 and session_id in unique_sessions:
            print("\n🎉 SUCCESS: Session ID preservation fix is working correctly!")
            print("   ✅ All API responses used the same session ID")
            print("   ✅ No new conversations were created")
            print("   ✅ Conversation continuity maintained")
            print("   ✅ The fix prevents session ID changes that create new conversations")
            return True
        else:
            print(f"\n❌ FAILURE: Session IDs were not preserved")
            print(f"   Expected 1 unique session ID, got {len(unique_sessions)}")
            return False

async def main():
    try:
        success = await test_session_preservation()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())