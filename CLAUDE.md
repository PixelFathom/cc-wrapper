# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack project management application with real-time chat sessions, file uploads, and approval workflows. Integrates with external deployment services and uses Clerk for authentication.

## Development Commands

### Quick Start
```bash
# Start development environment with hot-reload
make dev

# Start production environment
make up

# Stop services
make down        # Production
make dev-down    # Development

# Clean everything (containers + volumes)
make clean
```

### Backend Development (FastAPI)
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest                          # All tests
pytest tests/test_projects.py   # Specific test file
pytest -v                        # Verbose output

# Database migrations
alembic revision --autogenerate -m "description"  # Create new migration
alembic upgrade head                               # Apply migrations
alembic downgrade -1                               # Rollback last migration

# Create admin user (dev environment)
make create-admin  # Creates admin/admin user
```

### Frontend Development (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Testing
npm test                                    # Unit tests
npm run test:e2e                           # E2E tests with Playwright
npx playwright test --project=chromium     # Specific browser
npx playwright test --project="Mobile Chrome"

# Code quality
npm run type-check    # TypeScript type checking
npm run lint          # ESLint
```

### Database & Cache Access
```bash
# PostgreSQL shell
make db-shell
# or
docker-compose exec db psql -U postgres -d project_mgr

# Redis CLI
make redis-cli
# or
docker-compose exec cache redis-cli
```

### Monitoring
```bash
# View logs
make logs           # All services
make frontend-logs  # Frontend only
make backend-logs   # Backend only

# Follow logs
docker-compose logs -f [service_name]
```

## Architecture

### Tech Stack
- **Backend**: FastAPI (Python 3.12) with async/await
- **Database**: PostgreSQL 15 with SQLModel ORM
- **Cache**: Redis 7 for sessions and pub/sub
- **Frontend**: Next.js 14 (App Router) with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Auth**: Clerk authentication
- **State**: TanStack Query for server state
- **Testing**: Playwright (E2E), Jest (unit), pytest (backend)

### Backend Structure
```
backend/
├── app/
│   ├── api/                 # API routes
│   │   ├── approvals.py     # Approval workflow endpoints
│   │   ├── auto_continuation.py  # Auto-continuation logic
│   │   ├── chat.py          # Chat session management
│   │   ├── files.py         # File upload handling
│   │   ├── projects.py      # Project management
│   │   ├── tasks.py         # Task management
│   │   └── v1/              # Versioned endpoints
│   │       ├── mcp_approvals.py  # MCP approval handling
│   │       └── webhooks.py       # Webhook endpoints
│   ├── core/
│   │   ├── auto_continuation_config.py
│   │   ├── redis.py         # Redis connection management
│   │   └── settings.py      # Pydantic settings
│   ├── models/              # SQLModel database models
│   │   ├── approval.py
│   │   ├── chat.py
│   │   ├── deployment_hook.py
│   │   ├── project.py
│   │   └── task.py
│   ├── schemas/             # Pydantic schemas for API
│   ├── services/            # Business logic layer
│   │   ├── approval_service.py
│   │   ├── chat_service.py
│   │   ├── deployment_service.py
│   │   └── file_upload_service.py
│   ├── deps.py              # Dependency injection
│   └── main.py              # FastAPI app initialization
├── alembic/                 # Database migrations
├── tests/                   # Test suite
└── requirements.txt
```

### Frontend Structure  
```
frontend/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Clerk provider
│   ├── page.tsx            # Home page
│   ├── p/[projectId]/      # Project pages
│   └── test-auth/          # Auth testing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── navigation.tsx      # Main navigation
│   ├── chat-session.tsx    # Chat interface
│   ├── file-upload.tsx     # File upload component
│   └── approval-dialog.tsx # Approval workflow UI
├── lib/
│   ├── api.ts              # API client
│   └── utils.ts            # Utility functions
├── middleware.ts           # Clerk auth middleware
└── package.json
```

### Key Architectural Patterns

1. **Fire-and-forget with Webhooks**: Chat queries return immediately with task_id, processing happens async with webhook notifications
2. **Session Continuity**: Stateless design with session_id for conversation continuity
3. **Streaming Responses**: SSE/WebSocket support for real-time updates
4. **Approval Workflows**: Pause/resume pattern with MCP integration
5. **Service Layer**: Business logic separated from API routes
6. **Dependency Injection**: FastAPI's dependency system for clean architecture

## API Endpoints

### Core Endpoints
- `POST /api/query` - Submit chat query (returns task_id)
- `POST /api/init_project` - Initialize new project
- `POST /api/upload_file` - Upload files with drag-and-drop
- `GET /api/approvals/pending` - Get pending approvals
- `POST /api/approvals/result` - Submit approval decision
- `POST /api/webhooks/deployment/{task_id}` - Deployment status webhook
- `GET /api/v1/mcp/approvals/pending` - MCP-specific approvals

### WebSocket/SSE
- Real-time updates via polling (2-second intervals)
- Chat streaming for live execution feedback
- Approval notifications

## Environment Configuration

### Required Environment Variables
```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=project_mgr
POSTGRES_HOST=db  # or localhost for local dev

# Redis
REDIS_URL=redis://cache:6379/0  # or redis://localhost:6379/0

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8000  # Backend API
DEPLOYMENT_SERVICE_URL=http://localhost:8001  # External service

# Optional
BYPASS_MODE=false  # Skip approvals in dev
```

### Service Ports
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`  
- External Deployment: `http://localhost:8001`
- PostgreSQL: `5432`
- Redis: `6379`

## Docker Configuration

### Networks
- Uses `cc-wrapper` external network for service communication
- `host.docker.internal` for external service access from containers

### Volumes
- `db-data`: PostgreSQL data persistence
- `redis-data`: Redis data persistence
- Frontend mounts with node_modules and .next excluded

### Configurations
- `docker-compose.yaml` - Production setup
- `docker-compose.dev.yaml` - Development with hot-reload
- Both use `.env` file for configuration

## Testing Strategy

### Backend Testing
```bash
cd backend
pytest                    # Run all tests
pytest -v                  # Verbose output
pytest tests/test_chat_service.py  # Specific test
pytest --cov=app          # With coverage
```

### Frontend Testing
```bash
cd frontend
npm test                  # Jest unit tests
npm run test:e2e          # Playwright E2E
npx playwright test --ui  # Interactive UI mode
```

### Test Files
- Backend: `backend/tests/` - pytest async tests
- Frontend unit: `frontend/**/*.test.{ts,tsx}`
- E2E: `frontend/tests/` - Playwright tests

## Database Management

### Alembic Migrations
```bash
cd backend

# Create migration from model changes
alembic revision --autogenerate -m "add_new_field"

# Apply all migrations
alembic upgrade head

# Rollback
alembic downgrade -1  # Previous migration
alembic downgrade base  # All migrations

# View migration history
alembic history
```

### Common Migration Issues
- Enum changes: May require custom migration scripts
- Foreign keys: Check cascade rules
- Nullable fields: Set defaults for existing data

## Authentication Flow

1. **Clerk Integration**: Middleware protects routes requiring auth
2. **Public Routes**: Configured in `middleware.ts`
3. **User Context**: Available via Clerk hooks in components
4. **API Auth**: Bearer token passed in headers

## Deployment Integration

### Webhook Flow
1. Task initiated → External service called
2. Service processes → Sends webhook to `/api/webhooks/deployment/{task_id}`
3. Status updated in database
4. Frontend polls for updates

### Approval Workflow
1. Tool use triggers approval request
2. User notified via UI
3. Approval/rejection sent to backend
4. Process continues or halts based on decision

## Performance Considerations

- **Async Operations**: All I/O operations are async
- **Connection Pooling**: PostgreSQL and Redis connection pools
- **Caching**: Redis for session data and frequent queries
- **Pagination**: Implemented on list endpoints
- **File Uploads**: Chunked upload for large files

## Security Notes

- CORS configured for specific origins
- Clerk handles authentication
- Environment variables for secrets
- SQL injection protection via SQLModel
- Input validation with Pydantic schemas