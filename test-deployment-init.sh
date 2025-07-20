#!/bin/bash

echo "=== Testing Deployment Initialization ==="
echo

# Test task that's in pending state
TASK_ID="1e08986a-c013-4d4d-80d6-a3de5dd043b7"

echo "1. Checking current task status..."
TASK_RESPONSE=$(curl -s http://localhost:8000/api/tasks/$TASK_ID)
CURRENT_STATUS=$(echo $TASK_RESPONSE | jq -r '.deployment_status' 2>/dev/null)
echo "   Current status: $CURRENT_STATUS"

echo "2. Checking deployment hooks..."
HOOKS_RESPONSE=$(curl -s http://localhost:8000/api/tasks/$TASK_ID/deployment-hooks)
HOOKS_COUNT=$(echo $HOOKS_RESPONSE | jq '.hooks | length' 2>/dev/null || echo "0")
echo "   Current hooks: $HOOKS_COUNT"

echo "3. Testing deployment initialization endpoint..."
curl -s -X POST http://localhost:8000/api/tasks/$TASK_ID/init-deployment > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Deployment initialization endpoint is accessible"
else
    echo "   ❌ Deployment initialization endpoint failed"
fi

echo
echo "=== Testing URLs ==="
echo "Frontend: http://localhost:3001"
echo "Task Detail: http://localhost:3001/p/fabcffae-9ba5-4809-b7bc-03c9726fc458/t/$TASK_ID"
echo "API Task: http://localhost:8000/api/tasks/$TASK_ID"
echo "Deployment Hooks: http://localhost:8000/api/tasks/$TASK_ID/deployment-hooks"
echo

echo "=== Manual Testing Steps ==="
echo "1. Open: http://localhost:3001/p/fabcffae-9ba5-4809-b7bc-03c9726fc458/t/$TASK_ID"
echo "2. Click on 'Deployment' tab"
echo "3. Watch for status changes from 'pending' to 'initializing'"
echo "4. Monitor deployment logs for webhook updates"
echo "5. Check browser console for any errors"
echo "6. Verify status transitions in the deployment logs terminal"