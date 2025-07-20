#!/bin/bash

echo "=== Testing API Endpoints ==="
echo

# Test backend health
echo "1. Testing backend health..."
curl -s http://localhost:8000/api/projects > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend is not responding"
    exit 1
fi

# Test frontend accessibility
echo "2. Testing frontend accessibility..."
curl -s http://localhost:3001 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
    exit 1
fi

# Test database connectivity (indirect through API)
echo "3. Testing database connectivity..."
PROJECTS_RESPONSE=$(curl -s http://localhost:8000/api/projects)
if [ $? -eq 0 ]; then
    echo "✅ Database connection working"
    echo "   Current projects: $(echo $PROJECTS_RESPONSE | jq length 2>/dev/null || echo "Unable to parse")"
else
    echo "❌ Database connection failed"
fi

# Test external service (if available)
echo "4. Testing external service..."
curl -s http://localhost:8001/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ External service is available"
else
    echo "⚠️  External service is not available (this is expected if not running)"
fi

echo
echo "=== Manual Testing Instructions ==="
echo "1. Open browser to: http://localhost:3001"
echo "2. Create a new project"
echo "3. Create a new task"
echo "4. Navigate to task detail page"
echo "5. Monitor deployment tab for status changes"
echo "6. Check browser console for errors"
echo
echo "See test-deployment-flow.md for detailed testing steps"