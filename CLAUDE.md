# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full Stack Development
```bash
# Start entire application (production)
make up
# or
docker-compose up

# Start development environment
make dev
# or
docker-compose -f docker-compose.dev.yaml up

# View logs
make logs
make frontend-logs
make backend-logs

# Stop services
make down
make dev-down  # For development environment

# Clean up containers and volumes
make clean

# Build Docker images
make build

# Database shell
make db-shell

# Redis CLI
make redis-cli
```

### Backend Development (FastAPI)
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Run backend tests
pytest

# Run specific test
pytest tests/test_projects.py

# Generate new migration
alembic revision --autogenerate -m "description"
```

### Frontend Development (Next.js)
```bash
cd frontend
npm install
npm run dev

# Build for production
npm run build
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Run unit tests
npm test

# Run E2E tests with Playwright
npm run test:e2e

# Run E2E tests in different browsers
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

## Architecture Overview

This is a full-stack project management application with:

- **Backend**: FastAPI (Python 3.12) with async support
- **Database**: PostgreSQL 15 with SQLModel ORM and Alembic migrations
- **Cache**: Redis 7 for session management and pub/sub
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and shadcn/ui components
- **State Management**: TanStack Query for API state management
- **Testing**: Playwright for E2E tests, Jest for unit tests, pytest for backend

### Key Features
- Real-time chat sessions with streaming execution hooks
- File upload system with drag-and-drop interface
- Approval flow system with pause/resume capabilities
- Deployment integration with external services via webhooks
- SSE/WebSocket support for live updates

## Database Management

The application uses Alembic for database migrations:

```bash
cd backend
# Create new migration
alembic revision --autogenerate -m "migration description"

# Apply migrations
alembic upgrade head

# Downgrade migrations
alembic downgrade -1
```

## Key API Endpoints

- `POST /api/query` - Send chat queries
- `POST /api/init_project` - Initialize a new project
- `POST /api/upload_file` - Upload files
- `GET /api/approvals/pending` - Get pending approvals
- `POST /api/approvals/result` - Submit approval decisions
- `POST /api/webhooks/deployment/{task_id}` - Deployment webhook endpoint

## Frontend Architecture

The frontend uses Next.js App Router with the following structure:

- `app/` - Next.js pages using App Router
- `components/` - Reusable React components including shadcn/ui components
- `lib/` - Utility functions and API client
- Uses TanStack Query for server state management
- Real-time polling every 2 seconds for deployment updates

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
# Unit tests
npm test

# E2E tests with Playwright
npm run test:e2e
```

### Integration Testing
The project includes comprehensive test scripts in the root directory for testing deployment flows and API endpoints.

## Environment Setup

The application requires environment variables defined in `.env` file. Services run on:
- Frontend: http://localhost:3000 (or 3001 in some configs)
- Backend API: http://localhost:8000
- External deployment service: http://localhost:8001

## Docker Configuration

Two Docker Compose configurations are available:
- `docker-compose.yaml` - Production setup
- `docker-compose.dev.yaml` - Development setup with hot reloading

The application uses proper Docker networking with `host.docker.internal` for external service communication.