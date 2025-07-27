#!/usr/bin/env python3
"""
API Session ID Fix Test

This script tests the session ID preservation fix by directly calling the backend API
and verifying that session IDs are preserved correctly for continuing conversations.
"""

import asyncio
import json
import aiohttp
import uuid
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8000"

class SessionTestClient:
    def __init__(self):
        self.session_id: Optional[str] = None
        self.conversation_log = []
        
    async def send_query(self, prompt: str, session: aiohttp.ClientSession) -> Dict[str, Any]:
        """Send a query to the API and return the response"""
        payload = {
            "prompt": prompt,
            "org_name": "default", 
            "cwd": "cc-wrapper-3/test-ecf201ba-5a36-47ad-8027-f17c30397286"
        }
        
        # Include session_id if we have one (for continuing conversations)
        if self.session_id:
            payload["session_id"] = self.session_id
            
        print(f"📤 Sending query (session_id: {payload.get('session_id', 'None')}): {prompt[:50]}...")
        
        async with session.post(f"{BASE_URL}/api/query", json=payload) as response:
            if response.status != 200:
                text = await response.text()
                raise Exception(f"API error {response.status}: {text}")
                
            result = await response.json()
            
            print(f"📥 Response (session_id: {result.get('session_id', 'None')}): Status {response.status}")
            
            # Log this interaction
            self.conversation_log.append({
                "request_session_id": payload.get("session_id"),
                "response_session_id": result.get("session_id"),
                "prompt": prompt,
                "response": result
            })
            
            return result
    
    async def wait_for_completion(self, session_id: str, session: aiohttp.ClientSession, timeout: int = 60):
        """Wait for conversation to complete by polling the session"""
        print(f"⏳ Waiting for completion (session: {session_id})...")
        
        for i in range(timeout):
            try:
                async with session.get(f"{BASE_URL}/api/chats/session/{session_id}") as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get("messages", [])
                        
                        # Check if the last assistant message is no longer processing
                        last_assistant = None
                        for msg in reversed(messages):
                            if msg.get("role") == "assistant":
                                last_assistant = msg
                                break
                        
                        if last_assistant:
                            metadata = last_assistant.get("content", {}).get("metadata", {})
                            status = metadata.get("status", "")
                            
                            if status == "completed" and last_assistant.get("content", {}).get("text"):
                                print(f"✅ Conversation completed!")
                                return messages
                        
                        # Wait a bit before checking again
                        await asyncio.sleep(1)
                        
            except Exception as e:
                print(f"❌ Error checking completion: {e}")
                await asyncio.sleep(1)
        
        raise Exception("Timeout waiting for conversation completion")

async def test_session_preservation():
    """Test that session IDs are preserved correctly"""
    print("🧪 Testing Session ID Preservation Fix")
    print("=" * 50)
    
    client = SessionTestClient()
    
    async with aiohttp.ClientSession() as session:
        # Test 1: First message (should establish session ID)
        print("\n📝 Test 1: First message")
        response1 = await client.send_query("Hello, this is my first test message", session)
        
        # Extract session ID from response
        session_id = response1.get("session_id")
        if not session_id:
            raise Exception("❌ First response did not provide session_id")
            
        client.session_id = session_id
        print(f"✅ Established session ID: {session_id}")
        
        # Wait for first message to complete
        messages1 = await client.wait_for_completion(session_id, session)
        print(f"✅ First message completed with {len(messages1)} messages")
        
        # Test 2: Second message (should use same session ID)
        print("\n📝 Test 2: Second message (testing session preservation)")
        response2 = await client.send_query("This is my second message to test session continuity", session)
        
        # Verify session ID is preserved
        response2_session_id = response2.get("session_id")
        if response2_session_id != session_id:
            raise Exception(f"❌ Session ID changed! Expected: {session_id}, Got: {response2_session_id}")
            
        print(f"✅ Session ID preserved: {response2_session_id}")
        
        # Wait for second message to complete
        messages2 = await client.wait_for_completion(session_id, session)
        print(f"✅ Second message completed with {len(messages2)} messages")
        
        # Test 3: Third message (final verification)
        print("\n📝 Test 3: Third message (final verification)")
        response3 = await client.send_query("Third message for final session verification", session)
        
        response3_session_id = response3.get("session_id")
        if response3_session_id != session_id:
            raise Exception(f"❌ Session ID changed! Expected: {session_id}, Got: {response3_session_id}")
            
        print(f"✅ Session ID preserved: {response3_session_id}")
        
        # Wait for third message to complete
        messages3 = await client.wait_for_completion(session_id, session)
        print(f"✅ Third message completed with {len(messages3)} messages")
        
        # Verify all messages belong to the same session
        print("\n🔍 Verifying message session consistency...")
        session_ids_in_messages = set()
        for msg in messages3:
            msg_session_id = msg.get("session_id")
            if msg_session_id:
                session_ids_in_messages.add(msg_session_id)
        
        if len(session_ids_in_messages) != 1:
            raise Exception(f"❌ Multiple session IDs found in messages: {session_ids_in_messages}")
            
        if session_id not in session_ids_in_messages:
            raise Exception(f"❌ Expected session ID {session_id} not found in messages")
            
        print(f"✅ All messages consistently use session ID: {session_id}")
        
        # Summary
        print("\n📊 Test Summary:")
        print(f"   Total API calls: {len(client.conversation_log)}")
        print(f"   Session ID: {session_id}")
        print(f"   Final message count: {len(messages3)}")
        
        all_response_sessions = [log["response_session_id"] for log in client.conversation_log]
        unique_sessions = set(all_response_sessions)
        
        print(f"   Unique session IDs in responses: {len(unique_sessions)}")
        print(f"   Session IDs: {list(unique_sessions)}")
        
        if len(unique_sessions) == 1 and session_id in unique_sessions:
            print("\n🎉 SUCCESS: Session ID preservation fix is working correctly!")
            print("   ✅ All API responses used the same session ID")
            print("   ✅ No new conversations were created")
            print("   ✅ Conversation continuity maintained")
            return True
        else:
            print(f"\n❌ FAILURE: Session IDs were not preserved")
            return False

async def main():
    try:
        success = await test_session_preservation()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())