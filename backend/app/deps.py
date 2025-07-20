from typing import AsyncGenerator
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from app.core.settings import get_settings
from app.core.redis import get_redis
import redis.asyncio as redis

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,  # Disable SQL logging
    future=True
)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_redis_client() -> redis.Redis:
    return await get_redis()