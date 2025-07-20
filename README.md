# Project Management Tool

A FastAPI + PostgreSQL + Redis backend with a mobile-friendly Next.js frontend for managing projects, tasks, and collaborative chat sessions.

## Architecture

- **Backend**: FastAPI (Python 3.12) with async support
- **Database**: PostgreSQL 15 with SQLModel ORM
- **Cache/Real-time**: Redis 7 for session management and pub/sub
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and shadcn/ui
- **State Management**: TanStack Query
- **Containerization**: Docker with docker-compose

## Quick Start

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Start the application:

```bash
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Features

- **Project Management**: Create and manage projects with repository links
- **Task Tracking**: Organize tasks within projects
- **Live Chat**: Real-time chat sessions with streaming execution hooks
- **File Uploads**: Drag-and-drop file uploads for tasks
- **Approval Flow**: Built-in approval system with pause/resume capabilities
- **Real-time Updates**: SSE/WebSocket support for live updates

## Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

- `POST /api/query` - Send chat queries
- `POST /api/init_project` - Initialize a new project
- `POST /api/upload_file` - Upload files
- `GET /api/approvals/pending` - Get pending approvals
- `POST /api/approvals/result` - Submit approval decisions
- Full CRUD for projects and tasks

## Database Schema

- **projects**: Project information with repository URLs
- **tasks**: Tasks associated with projects
- **sub_projects**: Final sub-projects within tasks
- **files**: Uploaded files for sub-projects
- **chats**: Chat messages with role-based content
- **approvals**: Approval requests and responses

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
npm run test:e2e
```

## License

Internal use only.