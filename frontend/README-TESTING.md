# Approval Widget Testing Guide

## Overview

This guide covers testing the new approval widget using Playwright in both local and Docker environments.

## Running Tests Locally

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

### Running Tests

1. **Start the development server** (in one terminal):
   ```bash
   npm run dev
   ```

2. **Run all tests** (in another terminal):
   ```bash
   npm run test:e2e
   ```

3. **Run specific test files**:
   ```bash
   # Simple tests (recommended for quick verification)
   npx playwright test approval-widget-simple.spec.ts
   
   # Comprehensive tests
   npx playwright test approval-widget.spec.ts
   ```

4. **Run with UI mode** (for debugging):
   ```bash
   npx playwright test --ui
   ```

## Running Tests in Docker

### Using Docker Compose

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

2. **Run tests in Docker container**:
   ```bash
   # Enter the frontend container
   docker-compose exec frontend bash
   
   # Run the Docker-specific test script
   ./scripts/test-docker.sh
   ```

### Using Standalone Docker

1. **Build the Docker image**:
   ```bash
   docker build -t cfpj-frontend-tests -f Dockerfile.test .
   ```

2. **Run tests in Docker**:
   ```bash
   docker run --rm \
     -e DOCKER_ENV=true \
     --network="host" \
     cfpj-frontend-tests
   ```

## Test Structure

### approval-widget-simple.spec.ts
Basic smoke tests that verify:
- Widget loads and is visible
- Panel opens and closes
- Empty state displays correctly
- Mock approvals show up

### approval-widget.spec.ts
Comprehensive tests covering:
- All UI states and interactions
- Keyboard shortcuts
- API mocking and error handling
- Responsive behavior
- Real-time updates

## Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   - Clear Next.js cache: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

2. **Tests timeout in Docker**:
   - Increase timeouts in playwright-docker.config.ts
   - Ensure the backend service is running
   - Check Docker resource allocation

3. **API mocking not working**:
   - Verify the API endpoints match your backend routes
   - Check that route handlers are set up before navigation

### Docker-Specific Issues

1. **Connection refused errors**:
   - Use `host.docker.internal` instead of `localhost` in Docker
   - Ensure all services are in the same Docker network

2. **Browser launch failures**:
   - The Docker config includes `--no-sandbox` flags
   - Ensure the Docker image has all required dependencies

## API Endpoints

The approval widget expects these endpoints:

- `GET /api/approvals/pending` - Fetch pending approvals
- `POST /api/approvals/result` - Submit approval decision

Example mock response:
```json
[
  {
    "id": "uuid",
    "type": "mcp",
    "tool_name": "Bash",
    "display_text": "Execute command: npm install",
    "cwd": "/project/path",
    "created_at": "2024-01-01T00:00:00Z",
    "urgency": "high"
  }
]
```

## Best Practices

1. **Always mock API calls** in tests to ensure consistency
2. **Use data-testid attributes** for critical elements
3. **Test both desktop and mobile viewports**
4. **Include error scenarios** in your test suite
5. **Keep tests independent** - each test should set up its own state

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
- name: Run Playwright tests
  run: |
    npm ci
    npx playwright install --with-deps chromium
    npm run test:e2e
  env:
    CI: true
```