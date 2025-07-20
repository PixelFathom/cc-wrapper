from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlmodel import SQLModel
import logging

from app.core.settings import get_settings
from app.core.redis import close_redis
from app.deps import engine
from app.api import projects, tasks, chat, files, approvals
from app.api.v1 import webhooks, mcp_approvals

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
        "https://localhost:3000", 
        "https://tanmay-local.chatwoot.dev",
        "http://tanmay-local.chatwoot.dev",
        "https://tnifpo-ip-49-43-243-126.tunnelmole.net",
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
app.include_router(webhooks.router, prefix="/api", tags=["webhooks"])
app.include_router(mcp_approvals.router, prefix="/api", tags=["mcp-approvals"])


@app.get("/")
async def root():
    return {"message": "Project Management API v1.0"}