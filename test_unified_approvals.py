#!/usr/bin/env python3
"""
Test script to verify unified approvals endpoint returns both regular and MCP approvals
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def test_unified_approvals():
    """Test that the unified approvals endpoint returns all types of approvals"""
    
    print("Testing Unified Approvals Endpoint")
    print("=" * 50)
    
    # Test 1: Get all pending approvals (no filters)
    print("\n1. Getting ALL pending approvals...")
    response = requests.get(f"{BASE_URL}/approvals/pending")
    
    if response.status_code == 200:
        approvals = response.json()
        print(f"✓ Found {len(approvals)} total approvals")
        
        # Count by type
        regular_count = sum(1 for a in approvals if a.get('type') == 'regular')
        mcp_count = sum(1 for a in approvals if a.get('type') == 'mcp')
        
        print(f"  - Regular approvals: {regular_count}")
        print(f"  - MCP approvals: {mcp_count}")
        
        # Show details of each approval
        for approval in approvals[:5]:  # Show first 5
            print(f"\n  Approval {approval['id'][:8]}...")
            print(f"    Type: {approval.get('type', 'unknown')}")
            if approval.get('type') == 'mcp':
                print(f"    Tool: {approval.get('tool_name', 'N/A')}")
                print(f"    Display: {approval.get('display_text', 'N/A')}")
            else:
                print(f"    Action: {approval.get('action_type', 'N/A')}")
            print(f"    Created: {approval.get('created_at', 'N/A')}")
            print(f"    SubProject: {approval.get('sub_project_id', 'N/A')}")
        
        if len(approvals) > 5:
            print(f"\n  ... and {len(approvals) - 5} more approvals")
    else:
        print(f"✗ Failed with status {response.status_code}")
        print(f"  Response: {response.text}")
    
    # Test 2: Get approvals for specific sub_project
    print("\n\n2. Testing with sub_project_id filter...")
    if approvals and approvals[0].get('sub_project_id'):
        sub_project_id = approvals[0]['sub_project_id']
        print(f"   Using sub_project_id: {sub_project_id}")
        
        response = requests.get(f"{BASE_URL}/approvals/pending?sub_project_id={sub_project_id}")
        if response.status_code == 200:
            filtered_approvals = response.json()
            print(f"✓ Found {len(filtered_approvals)} approvals for this sub_project")
        else:
            print(f"✗ Failed with status {response.status_code}")
    
    print("\n" + "=" * 50)
    print("Test complete!")

if __name__ == "__main__":
    test_unified_approvals()