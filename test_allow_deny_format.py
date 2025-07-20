#!/usr/bin/env python3
"""
Test script to verify approval decisions are sent as "allow"/"deny" to port 8083
"""

import asyncio
from uuid import uuid4
from app.services.approval_service import approval_service

async def test_decision_format():
    """Test that decisions are sent as allow/deny"""
    
    print("Testing Approval Decision Format")
    print("=" * 50)
    print("Expected format at port 8083:")
    print('  {"decision": "allow" | "deny", "reason": "string"}\n')
    
    # Test 1: Allow decision
    approval_id = uuid4()
    print(f"1. Testing ALLOW decision for approval_id: {approval_id}")
    await approval_service.send_approval_to_external_service(
        approval_id=approval_id,
        decision="allow",
        reason="Test allow decision"
    )
    
    # Test 2: Deny decision
    approval_id = uuid4()
    print(f"\n2. Testing DENY decision for approval_id: {approval_id}")
    await approval_service.send_approval_to_external_service(
        approval_id=approval_id,
        decision="deny",
        reason="Test deny decision"
    )
    
    print("\n" + "=" * 50)
    print("Check the logs above to verify decisions are sent as 'allow' or 'deny'")
    print("Endpoint: http://localhost:8083/approval-callback")

if __name__ == "__main__":
    asyncio.run(test_decision_format())