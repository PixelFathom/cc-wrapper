#!/bin/bash
# Script to run Playwright tests in Docker environment

echo "🧪 Running Playwright tests in Docker environment..."

# Set Docker environment variable
export DOCKER_ENV=true

# Install Playwright browsers if not already installed
if [ ! -d "~/.cache/ms-playwright" ]; then
  echo "📦 Installing Playwright browsers..."
  npx playwright install chromium
fi

# Run tests with Docker configuration
echo "🚀 Starting tests..."
npx playwright test --config=playwright-docker.config.ts "$@"

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed. Check the report for details."
  exit 1
fi