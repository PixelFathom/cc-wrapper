from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from uuid import UUID
from app.deps import get_session, get_redis_client
from app.services.deployment_service import deployment_service
from app.services.chat_service import chat_service
from app.services.test_case_service import test_case_service
from app.services.contest_harvesting_service import contest_harvesting_service
import logging
import redis.asyncio as redis

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhooks/deployment/{task_id}")
async def receive_deployment_webhook(
    task_id: UUID,
    webhook_data: Dict[str, Any],
    session: AsyncSession = Depends(get_session)
):
    """Receive deployment status webhooks from remote service"""
    try:
        # Log webhook receipt with limited data for large payloads
        log_data = str(webhook_data)
        logger.info(f"Received webhook for task {task_id}: {webhook_data}")
        
        await deployment_service.process_webhook(session, task_id, webhook_data)
        return {"status": "received", "task_id": task_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Failed to process webhook")


@router.post("/webhooks/chat/{chat_id}")
async def receive_chat_webhook(
    chat_id: UUID,
    webhook_data: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Receive chat processing webhooks from remote service"""
    try:
        logger.info(
            f"🔴 Webhook endpoint called | "
            f"webhook_data={webhook_data}"
        )
        # Set Redis client for real-time updates
        chat_service.set_redis_client(redis_client)
        await chat_service.process_webhook(session, chat_id, webhook_data)
        return {"status": "received", "chat_id": chat_id}
    except ValueError as e:
        logger.error(f"❌ Webhook ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Webhook Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to process chat webhook")


@router.post("/webhooks/test-case/{test_case_id}")
async def receive_test_case_webhook(
    test_case_id: UUID,
    webhook_data: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Receive test case execution webhooks from remote service"""
    try:
        logger.info(
            f"🧪 Test case webhook endpoint called | "
            f"test_case_id={test_case_id} | "
            f"webhook_data={webhook_data}"
        )
        # Set Redis client for real-time updates
        test_case_service.set_redis_client(redis_client)
        await test_case_service.process_webhook(session, test_case_id, webhook_data)
        return {"status": "received", "test_case_id": test_case_id}
    except ValueError as e:
        logger.error(f"❌ Test case webhook ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Test case webhook Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to process test case webhook")


@router.post("/webhooks/contest-harvesting/{session_id}")
async def receive_contest_harvesting_webhook(
    session_id: UUID,
    webhook_data: Dict[str, Any],
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Receive contest harvesting webhooks from remote service"""
    try:
        logger.info(
            f"🏆 Contest harvesting webhook endpoint called | "
            f"session_id={session_id} | "
            f"webhook_data={webhook_data}"
        )
        # Set Redis client for real-time updates
        contest_harvesting_service.set_redis_client(redis_client)
        await contest_harvesting_service.process_webhook(session, session_id, webhook_data)
        return {"status": "received", "session_id": session_id}
    except ValueError as e:
        logger.error(f"❌ Contest harvesting webhook ValueError: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Contest harvesting webhook Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to process contest harvesting webhook")