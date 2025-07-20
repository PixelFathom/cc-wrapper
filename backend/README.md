# Backend API

FastAPI backend for the project management tool.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp ../.env.example ../.env
```

3. Run database migrations:
```bash
alembic upgrade head
```

4. Start the development server:
```bash
uvicorn app.main:app --reload
```

## Development Commands

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Format code
black app/
flake8 app/

# Run tests
pytest
pytest --cov=app
```

## API Documentation

Once the server is running, visit:
- OpenAPI docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── api/          # API route handlers
│   ├── core/         # Core configuration
│   ├── models/       # SQLModel database models
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   ├── deps.py       # Dependencies
│   └── main.py       # Application entry point
├── alembic/          # Database migrations
├── tests/            # Test files
└── requirements.txt  # Python dependencies
```

## Environment Variables

- `POSTGRES_HOST`: PostgreSQL host
- `POSTGRES_PORT`: PostgreSQL port
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name
- `REDIS_URL`: Redis connection URL

## Seed Data

To seed the database with sample data:

```python
# seed_data.py
import asyncio
from app.deps import get_session
from app.models import Project, Task

async def seed():
    async with get_session() as session:
        project = Project(
            name="Sample Project",
            repo_url="https://github.com/example/repo"
        )
        session.add(project)
        await session.commit()
        
        task = Task(
            name="Sample Task",
            project_id=project.id
        )
        session.add(task)
        await session.commit()

if __name__ == "__main__":
    asyncio.run(seed())
```