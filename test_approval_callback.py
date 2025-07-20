#!/usr/bin/env python3
"""
Test script to verify approval callback endpoint configuration
"""

import asyncio
from uuid import uuid4
from app.services.approval_service import approval_service

async def test_approval_callback():
    """Test the approval callback endpoint"""
    
    print("Testing approval callback to port 8083...")
    print("Endpoint: http://localhost:8083/approval-callback")
    print("-" * 50)
    
    # Test approved decision
    approval_id = uuid4()
    print(f"\n1. Testing APPROVED decision for approval_id: {approval_id}")
    await approval_service.send_approval_to_external_service(
        approval_id=approval_id,
        decision="approved",
        reason="Test approval reason"
    )
    
    # Test rejected decision
    approval_id = uuid4()
    print(f"\n2. Testing REJECTED decision for approval_id: {approval_id}")
    await approval_service.send_approval_to_external_service(
        approval_id=approval_id,
        decision="rejected",
        reason="Test rejection reason"
    )
    
    print("\n" + "-" * 50)
    print("Test complete. Check logs above for results.")
    print("Expected format: {decision: 'approved'/'rejected', reason: 'string'}")

if __name__ == "__main__":
    asyncio.run(test_approval_callback())