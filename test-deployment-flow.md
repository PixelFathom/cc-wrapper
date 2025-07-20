# Deployment Flow Testing Guide

## Test Environment Status
- Frontend: http://localhost:3001
- Backend: http://localhost:8000
- Database: PostgreSQL (port 5432)
- Cache: Redis (port 6379)

## Testing Steps

### 1. Homepage Navigation
- **URL**: `http://localhost:3001`
- **Expected**: Terminal-style homepage with project creation options
- **Check**: Look for "Create Project" button or similar UI element

### 2. Project Creation
- **Action**: Click the project creation button
- **Form Fields**:
  - Project Name (required)
  - Repository URL (required)
- **Expected**: Modal dialog with terminal-style design
- **Success**: Project should be created and visible in project list

### 3. Task Creation
- **Action**: Navigate to project detail page
- **URL Pattern**: `http://localhost:3001/p/{project-id}`
- **Action**: Create a new task within the project
- **Form Fields**: Task name (required)
- **Expected**: Task should be created with `deployment_status: "pending"`

### 4. Task Detail Navigation
- **URL Pattern**: `http://localhost:3001/p/{project-id}/t/{task-id}`
- **Expected**: Task detail page with three tabs:
  - **Deployment Tab** (default)
  - **Files Tab**
  - **Chat Tab**

### 5. Deployment Status Monitoring

#### Initial State
- **Expected Status**: "pending" 
- **UI**: Shows "Deployment will be initialized automatically"
- **Auto-initialization**: Should automatically trigger deployment after creation

#### Status Transitions
Monitor the deployment status through these states:
1. **pending** → **initializing** → **deploying** → **completed**
2. Or: **pending** → **initializing** → **failed**

#### Deployment Tab Features
- **Deployment Status Card**: Shows current status with color coding
  - `pending`: cyan
  - `initializing`: cyan with pulse animation
  - `deploying`: yellow with pulse animation
  - `completed`: green
  - `failed`: red
- **Deployment Logs**: Real-time log display in terminal-style window
- **Retry Button**: Available if deployment fails

### 6. Deployment Logs Verification

#### Log Display Features
- **Terminal-style window** with colored status indicators
- **Timestamp format**: `[HH:MM:SS]`
- **Status Icons**:
  - ✅ Green circle: completed
  - ❌ Red X: failed/error
  - 🔄 Spinning: processing/deploying
  - 🚀 Rocket: initiated
- **Real-time updates**: Polls every 2 seconds until completion

#### Expected Log Entries
1. **Initial Hook**: `init_project: Project initialization started`
2. **Status Updates**: Various deployment progress messages
3. **Completion Hook**: Final success/failure message

### 7. Browser Console Monitoring

#### Check for Common Issues
- **CORS Errors**: Should be resolved with current configuration
- **Network Timeouts**: Backend should respond within 30 seconds
- **API Endpoint Errors**: All endpoints should return proper responses
- **WebSocket/SSE Errors**: If using real-time features

#### Expected Console Behavior
- **No 5xx errors**: Server errors should be handled gracefully
- **Proper API responses**: All API calls should return expected data structures
- **React Query success**: Should see successful data fetching logs

### 8. Deployment Service Integration

#### External Service Communication
- **Service URL**: `http://host.docker.internal:8001/init-project`
- **Webhook URL**: `http://host.docker.internal:8000/api/webhooks/deployment/{task-id}`
- **Expected**: Successful communication between Docker containers and external service

#### Request Payload Structure
```json
{
  "organization_name": "default",
  "project_path": "{project-name}/{task-name}-{task-id}",
  "github_repo_url": "{project-repo-url}",
  "webhook_url": "http://host.docker.internal:8000/api/webhooks/deployment/{task-id}"
}
```

### 9. Database Verification

#### Task Table Updates
- `deployment_status` should change from "pending" to other states
- `deployment_started_at` should be populated when initialization begins
- `deployment_request_id` should contain the external service session ID
- `deployment_completed` should be true when finished
- `deployment_completed_at` should be populated on completion

#### DeploymentHook Table
- Should contain records for each webhook received
- `hook_type`, `status`, `data`, `message` fields should be populated
- `received_at` timestamps should show progression
- `is_complete` should be true for final hooks

### 10. Error Handling Verification

#### Network Failures
- **Test**: Stop external service temporarily
- **Expected**: Deployment should fail gracefully with "failed" status
- **UI**: Should show retry button and error message

#### Timeout Handling
- **Expected**: 30-second timeout on external service calls
- **UI**: Should show appropriate error message and retry option

### 11. Performance Monitoring

#### Response Times
- **Homepage Load**: < 2 seconds
- **Project Creation**: < 3 seconds
- **Task Creation**: < 3 seconds
- **Deployment Initialization**: < 5 seconds
- **Real-time Updates**: 2-second polling interval

#### Resource Usage
- **Memory**: Monitor for memory leaks during polling
- **CPU**: Should remain reasonable during active polling
- **Network**: Efficient API calls without excessive requests

## Testing Checklist

### Pre-Test Verification
- [ ] Docker containers are running
- [ ] External service is available at port 8001
- [ ] Database is accessible
- [ ] Redis cache is functional

### Functional Testing
- [ ] Homepage loads correctly
- [ ] Project creation works
- [ ] Task creation works
- [ ] Task detail page displays
- [ ] Deployment tab is visible
- [ ] Deployment status updates correctly
- [ ] Deployment logs display properly
- [ ] Real-time polling works
- [ ] Status transitions are visible
- [ ] Retry functionality works (if applicable)

### Technical Verification
- [ ] No console errors
- [ ] API responses are correct
- [ ] Database records update properly
- [ ] Webhook integration works
- [ ] Docker networking is functional
- [ ] External service communication works

### Edge Cases
- [ ] Network disconnection handling
- [ ] Service unavailability handling
- [ ] Timeout scenarios
- [ ] Invalid data handling
- [ ] Multiple simultaneous deployments

## Expected Fixes Validation

### Docker Networking
- **Issue**: Previous connection failures to external service
- **Fix**: Using `host.docker.internal:8001` for external service URL
- **Verification**: Deployment initialization should succeed

### Field Name Mismatches
- **Issue**: API response fields not matching frontend expectations
- **Fix**: Aligned field names between backend and frontend
- **Verification**: All deployment data should display correctly

### Webhook Integration
- **Issue**: Webhook URL not properly formatted
- **Fix**: Using `host.docker.internal:8000` for webhook base URL
- **Verification**: External service should successfully send webhooks

## Troubleshooting

### Common Issues
1. **Port conflicts**: Ensure ports 3001, 8000, 8001 are available
2. **Docker networking**: Verify host.docker.internal resolution
3. **Database connection**: Check PostgreSQL service health
4. **External service**: Confirm service is running on port 8001

### Debug Commands
```bash
# Check container status
docker-compose ps

# View backend logs
docker-compose logs backend

# View frontend logs
docker-compose logs frontend

# Check external service
curl http://localhost:8001/health

# Test API endpoint
curl http://localhost:8000/api/projects
```