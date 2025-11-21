from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlmodel import SQLModel
import logging

from app.core.settings import get_settings
from app.core.redis import close_redis
from app.deps import engine
from app.api import projects, tasks, chat, files, approvals, auto_continuation, test_cases, contest_harvesting, github_auth, github_repositories, github_issues, issue_resolution, subscriptions
from app.api.v1 import webhooks, mcp_approvals

# Import models to ensure they are registered with SQLAlchemy
from app.models import (
    TestCaseHook, ContestHarvestingSession, HarvestingQuestion,
    User, UserToken, AuditLog, GitHubRepository, GitHubIssue, IssueResolution,
    CoinTransaction
)  # Ensure tables are created

settings = get_settings()

# Import and setup custom logging
from logging_config import setup_logging
setup_logging()

# Force unbuffered output
import sys
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    await close_redis()


app = FastAPI(
    title="Project Management API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:2000",
        "https://localhost:3000", 
        "https://code.thegetshitdone.ai",
        "https://api-code.thegetshitdone.ai",
        "https://code.tanmaydeepsharma.com",
        "https://code-api.tanmaydeepsharma.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(approvals.router, prefix="/api", tags=["approvals"])
app.include_router(auto_continuation.router, prefix="/api", tags=["auto-continuation"])
app.include_router(test_cases.router, prefix="/api", tags=["test-cases"])
app.include_router(contest_harvesting.router, prefix="/api", tags=["contest-harvesting"])
app.include_router(webhooks.router, prefix="/api", tags=["webhooks"])
app.include_router(mcp_approvals.router, prefix="/api", tags=["mcp-approvals"])
app.include_router(github_auth.router, prefix="/api", tags=["github-auth"])
app.include_router(github_repositories.router, prefix="/api", tags=["github-repositories"])
app.include_router(github_issues.router, prefix="/api", tags=["github-issues"])
app.include_router(issue_resolution.router, prefix="/api", tags=["issue-resolution"])
app.include_router(subscriptions.router, prefix="/api", tags=["subscriptions"])


@app.get("/")
async def root():
    return {"message": "Project Management API v1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy"}
