#!/bin/bash

echo "Testing MCP Approval Flow"
echo "========================"

# Wait for backend to be ready
sleep 3

# Test 1: Send an approval request
echo -e "\n1. Sending approval request..."
curl -X POST http://localhost:8000/api/approval-request \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-'$(date +%s)'",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "tool_name": "Bash",
    "tool_input": {
      "command": "ls -la",
      "cwd": "practice/task1/sub1"
    },
    "callback_url": "http://localhost:8083/approval-callback",
    "display_text": "Execute command: ls -la"
  }' | jq .

# Test 2: Get pending approvals
echo -e "\n2. Getting pending approvals..."
curl -X GET http://localhost:8000/api/approvals/pending | jq .

echo -e "\nTest complete. Check the frontend for approval notifications."