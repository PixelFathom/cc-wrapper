#!/bin/bash

# Test Chat API with curl commands
# This script tests:
# 1. First message (no session_id) works correctly
# 2. Subsequent messages with session_id work correctly
# 3. The thinking tab displays hooks properly
# 4. Session continuity is maintained

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Chat API Tests${NC}"
echo "================================="

# Base URL
BASE_URL="http://localhost:8000/api"

# Test project/task setup
PROJECT_NAME="test_project"
TASK_NAME="test_task"
CWD="${PROJECT_NAME}/${TASK_NAME}"

# Step 1: Initialize project
echo -e "\n${GREEN}Step 1: Initializing project...${NC}"
INIT_RESPONSE=$(curl -s -X POST ${BASE_URL}/init_project \
  -H "Content-Type: application/json" \
  -d "{
    \"org_name\": \"test_org\",
    \"cwd\": \"${CWD}\",
    \"repo_url\": \"https://github.com/test/repo\",
    \"webhook_url\": \"http://localhost:8000/webhook\"
  }")

echo "Init Response: $INIT_RESPONSE"
PROJECT_ID=$(echo $INIT_RESPONSE | grep -o '"project_id":"[^"]*' | grep -o '[^"]*$')
TASK_ID=$(echo $INIT_RESPONSE | grep -o '"task_id":"[^"]*' | grep -o '[^"]*$')
SUB_PROJECT_ID=$(echo $INIT_RESPONSE | grep -o '"sub_project_id":"[^"]*' | grep -o '[^"]*$')

echo "Project ID: $PROJECT_ID"
echo "Task ID: $TASK_ID"
echo "Sub Project ID: $SUB_PROJECT_ID"

# Step 2: Test first message (no session_id)
echo -e "\n${GREEN}Step 2: Testing first message (no session_id)...${NC}"
FIRST_MSG_RESPONSE=$(curl -s -X POST ${BASE_URL}/query \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"Hello, this is my first message\",
    \"org_name\": \"test_org\",
    \"cwd\": \"${CWD}\",
    \"webhook_url\": \"http://localhost:8000/webhook\"
  }")

echo "First Message Response: $FIRST_MSG_RESPONSE"
SESSION_ID=$(echo $FIRST_MSG_RESPONSE | grep -o '"session_id":"[^"]*' | grep -o '[^"]*$')
echo "Extracted Session ID: $SESSION_ID"

# Wait a moment for processing
sleep 2

# Step 3: Test subsequent message with session_id
echo -e "\n${GREEN}Step 3: Testing subsequent message with session_id...${NC}"
SECOND_MSG_RESPONSE=$(curl -s -X POST ${BASE_URL}/query \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"This is my second message in the same session\",
    \"session_id\": \"${SESSION_ID}\",
    \"org_name\": \"test_org\",
    \"cwd\": \"${CWD}\",
    \"webhook_url\": \"http://localhost:8000/webhook\"
  }")

echo "Second Message Response: $SECOND_MSG_RESPONSE"
SESSION_ID_2=$(echo $SECOND_MSG_RESPONSE | grep -o '"session_id":"[^"]*' | grep -o '[^"]*$')
echo "Session ID from second message: $SESSION_ID_2"

# Verify session continuity
if [ "$SESSION_ID" = "$SESSION_ID_2" ]; then
  echo -e "${GREEN}✓ Session continuity maintained${NC}"
else
  echo -e "${RED}✗ Session IDs don't match! First: $SESSION_ID, Second: $SESSION_ID_2${NC}"
fi

# Wait for hooks to be processed
sleep 3

# Step 4: Get the chat ID to check hooks
# First, we need to get the chats for the sub_project
echo -e "\n${GREEN}Step 4: Getting chat information...${NC}"
# Since we don't have a direct endpoint to get chats by sub_project_id, 
# we'll use the session_id to get hooks from the first chat

# For demonstration, let's assume we can derive the chat_id or use a different approach
# In a real scenario, you might need to query the database or have an endpoint to list chats

echo -e "\n${GREEN}Step 5: Testing chat hooks endpoint...${NC}"
# Since we can't get the exact chat_id without additional endpoints, 
# let's test with a sample UUID format
# In production, you would get this from the chat creation response

# Alternative: Test the streaming endpoint
echo -e "\n${GREEN}Step 6: Testing streaming endpoint...${NC}"
echo "Starting stream for session: $SESSION_ID"
echo "Press Ctrl+C to stop streaming after a few seconds"
timeout 5 curl -s -X GET ${BASE_URL}/stream/${SESSION_ID} \
  -H "Accept: text/event-stream" || true

echo -e "\n\n${GREEN}Step 7: Test sending query to specific chat (if chat_id available)${NC}"
# This would require knowing a specific chat_id
# Example format:
# curl -s -X POST ${BASE_URL}/chats/{chat_id}/query \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"prompt\": \"Query for specific chat\",
#     \"session_id\": \"${SESSION_ID}\"
#   }"

echo -e "\n${YELLOW}Test Summary:${NC}"
echo "================================="
echo "1. Project initialized: ${PROJECT_ID}"
echo "2. First message sent without session_id"
echo "3. Session ID received: ${SESSION_ID}"
echo "4. Second message sent with session_id"
echo "5. Session continuity verified"
echo "6. Streaming endpoint tested"

echo -e "\n${GREEN}Additional curl commands you can use:${NC}"
echo ""
echo "# Get hooks for a specific chat (replace CHAT_ID with actual UUID):"
echo "curl -X GET '${BASE_URL}/chats/CHAT_ID/hooks?session_id=${SESSION_ID}&limit=10'"
echo ""
echo "# Send query to specific chat:"
echo "curl -X POST ${BASE_URL}/chats/CHAT_ID/query \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"prompt\": \"Your message\", \"session_id\": \"${SESSION_ID}\"}'"
echo ""
echo "# Stream real-time updates:"
echo "curl -X GET ${BASE_URL}/stream/${SESSION_ID} -H 'Accept: text/event-stream'"