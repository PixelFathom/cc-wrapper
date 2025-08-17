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

# View help for all available Make commands
make help
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
│   │   ├── test_cases.py    # Test case management
│   │   └── v1/              # Versioned endpoints
│   │       ├── mcp_approvals.py  # MCP approval handling
│   │       └── webhooks.py       # Webhook endpoints
│   ├── core/
│   │   ├── auto_continuation_config.py
│   │   ├── redis.py         # Redis connection management
│   │   └── settings.py      # Pydantic settings
│   ├── models/              # SQLModel database models
│   │   ├── approval.py
│   │   ├── approval_request.py
│   │   ├── chat.py
│   │   ├── chat_hook.py
│   │   ├── deployment_hook.py
│   │   ├── knowledge_base_file.py
│   │   ├── project.py
│   │   ├── sub_project.py
│   │   ├── task.py
│   │   ├── test_case.py
│   │   └── test_case_hook.py
│   ├── schemas/             # Pydantic schemas for API
│   ├── services/            # Business logic layer
│   │   ├── approval_service.py
│   │   ├── chat_service.py
│   │   ├── deployment_service.py
│   │   ├── file_upload_service.py
│   │   ├── test_case_service.py
│   │   └── test_generation_service.py
│   ├── deps.py              # Dependency injection
│   └── main.py              # FastAPI app initialization
├── alembic/                 # Database migrations
├── scripts/                 # Utility scripts (create_admin.py)
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
│   │   └── t/[taskId]/     # Task-specific pages
│   └── test-auth/          # Auth testing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── navigation.tsx      # Main navigation
│   ├── chat-sessions-list.tsx    # Chat interface
│   ├── upload-zone.tsx     # File upload component
│   ├── approval-center.tsx # Approval workflow UI
│   ├── mcp-approval-modal.tsx    # MCP-specific approvals
│   ├── test-case-generation-modal.tsx  # Test case UI
│   ├── deployment-guide-modal.tsx      # Deployment guides
│   └── mobile-chat-layout.tsx          # Mobile-responsive chat
├── lib/
│   ├── api.ts              # API client
│   ├── utils.ts            # Utility functions
│   ├── session-utils.ts    # Session management
│   ├── git-url-parser.ts   # Git URL parsing utilities
│   └── hooks/              # Custom React hooks
│       └── useMobile.ts
├── tests/                  # Playwright E2E tests
├── middleware.ts           # Clerk auth middleware
└── package.json
```

### Key Architectural Patterns

1. **Fire-and-forget with Webhooks**: Chat queries return immediately with task_id, processing happens async with webhook notifications
2. **Session Continuity**: Stateless design with session_id for conversation continuity
3. **Streaming Responses**: SSE/WebSocket support for real-time updates
4. **Approval Workflows**: Pause/resume pattern with MCP integration
5. **Test Case Management**: AI-generated test cases with execution hooks
6. **Sub-Project Architecture**: Hierarchical project organization
7. **Hook System**: Chat hooks and test case hooks for event-driven workflows
8. **Service Layer**: Business logic separated from API routes
9. **Dependency Injection**: FastAPI's dependency system for clean architecture

## API Endpoints

### Core Endpoints
- `POST /api/query` - Submit chat query (returns task_id)
- `POST /api/init_project` - Initialize new project
- `POST /api/upload_file` - Upload files with drag-and-drop
- `GET /api/approvals/pending` - Get pending approvals
- `POST /api/approvals/result` - Submit approval decision
- `POST /api/webhooks/deployment/{task_id}` - Deployment status webhook
- `GET /api/v1/mcp/approvals/pending` - MCP-specific approvals

### Test Case Management
- `GET /api/tasks/{task_id}/test-cases` - Get all test cases for a task
- `POST /api/tasks/{task_id}/test-cases` - Create new test case
- `POST /api/test-cases/{test_case_id}/execute` - Execute test case
- `POST /api/tasks/{task_id}/generate-test-cases` - AI-generate test cases

### Sub-Project Management
- Sub-projects allow hierarchical organization within projects
- Each sub-project can have its own chat sessions and resources

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

# Auto-continuation (OpenAI integration)
OPENAI_API_KEY=sk-...  # Required for auto-continuation features

# Production deployment
DEPLOYMENT_SERVICE_URL=http://localhost:8001  # External deployment service
```

### Service Ports
- Frontend: `http://localhost:2000` (Docker), `http://localhost:3000` (local dev)
- Backend API: `http://localhost:9000` (Docker), `http://localhost:8000` (local dev)
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
- `docker-compose.yaml` - Production setup with volume mounts for development
- `docker-compose.admin.yaml` - Admin-specific configuration
- Multiple Dockerfiles for different purposes:
  - `frontend/Dockerfile.dev` - Development build
  - `frontend/Dockerfile.simple` - Simple production build
  - `frontend/Dockerfile.test` - Testing environment
- All configurations use `.env` file for environment variables

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

# Run specific Playwright tests
npx playwright test tests/approval-widget.spec.ts
npx playwright test tests/conversation-continuity-final.spec.ts
npx playwright test tests/mcp-playwright-integration.spec.ts

# Run tests for specific browsers
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"

# Docker-based testing
./scripts/test-docker.sh  # Run tests in Docker environment
```

### Test Files
- Backend: `backend/tests/` - pytest async tests
  - `test_chat_service.py` - Chat functionality tests
  - `test_projects.py` - Project management tests
  - `test_bypass_mode.py` - Bypass mode functionality
- Frontend unit: `frontend/**/*.test.{ts,tsx}`
- E2E: `frontend/tests/` - Comprehensive Playwright test suite
  - Approval workflow tests
  - Session continuity tests
  - MCP integration tests
  - Mobile responsiveness tests
  - Bypass mode behavior tests

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

## Key Features

### Auto-Continuation System
- Powered by OpenAI integration for intelligent conversation flow
- Automatically determines when to continue conversations
- Configurable via `auto_continuation_config.py`
- Requires `OPENAI_API_KEY` environment variable

### Test Case Generation
- AI-powered test case generation for tasks
- Automated execution with webhook notifications
- Test case hooks for event-driven workflows
- Integration with external testing services

### MCP (Model Context Protocol) Integration
- Approval requests for tool usage
- Configurable MCP servers per task
- Webhook-based approval flow with pause/resume capability

### Bypass Mode
- Development feature to skip approval workflows
- Controlled via `BYPASS_MODE` environment variable
- Useful for rapid development and testing

## Performance Considerations

- **Async Operations**: All I/O operations are async
- **Connection Pooling**: PostgreSQL and Redis connection pools
- **Caching**: Redis for session data and frequent queries
- **Pagination**: Implemented on list endpoints
- **File Uploads**: Chunked upload for large files
- **Mobile Optimization**: Dedicated mobile layout components

## Security Notes

- CORS configured for specific origins
- Clerk handles authentication
- Environment variables for secrets
- SQL injection protection via SQLModel
- Input validation with Pydantic schemas

## Development Notes

### Database Schema Evolution
- The application has extensive migration history with many feature additions
- Pay attention to enum changes and foreign key relationships
- Use `alembic history` to understand migration dependencies

### External Network Requirement
- Requires `cc-wrapper` external Docker network
- Create with: `docker network create cc-wrapper`
- Essential for service communication between containers

### Logging and Debugging
- Custom logging configuration in `logging_config.py`
- Debug logs available at `backend_debug.log`
- Use `make logs` for real-time log monitoring

### Mobile-First Development
- Mobile responsiveness is a key requirement
- Dedicated mobile components and responsive layouts
- Test on both desktop and mobile breakpoints

### Git Integration
- Built-in Git URL parsing utilities
- Repository integration for project initialization
- Knowledge base file management for Claude context