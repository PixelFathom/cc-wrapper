from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime
import httpx
import redis.asyncio as redis

from ..deps import get_session, get_redis_client
from ..models.test_case import TestCase, TestCaseStatus, TestCaseCreate, TestCaseUpdate, TestCaseRead, TestCaseExecutionRequest
from ..models.test_case_hook import TestCaseHook
from ..services.test_case_service import test_case_service
from ..core.settings import get_settings

router = APIRouter()


@router.get("/tasks/{task_id}/test-cases", response_model=List[TestCaseRead])
async def get_test_cases(task_id: UUID, session: AsyncSession = Depends(get_session)):
    """Get all test cases for a task"""
    statement = select(TestCase).where(TestCase.task_id == task_id)
    result = await session.exec(statement)
    test_cases = result.all()
    return test_cases


@router.post("/tasks/{task_id}/test-cases", response_model=TestCaseRead)
async def create_test_case(
    task_id: UUID, 
    test_case_data: TestCaseCreate, 
    session: AsyncSession = Depends(get_session)
):
    """Create a new test case"""
    # Set task_id from URL parameter
    create_data = test_case_data.model_dump()
    create_data['task_id'] = task_id
    test_case = TestCase(**create_data)
    session.add(test_case)
    await session.commit()
    await session.refresh(test_case)
    return test_case


@router.get("/test-cases/{test_case_id}", response_model=TestCaseRead)
async def get_test_case(test_case_id: UUID, session: AsyncSession = Depends(get_session)):
    """Get a specific test case"""
    test_case = await session.get(TestCase, test_case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    return test_case


@router.put("/test-cases/{test_case_id}", response_model=TestCaseRead)
async def update_test_case(
    test_case_id: UUID, 
    test_case_data: TestCaseUpdate, 
    session: AsyncSession = Depends(get_session)
):
    """Update a test case"""
    test_case = await session.get(TestCase, test_case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    update_data = test_case_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(test_case, field, value)
    
    session.add(test_case)
    await session.commit()
    await session.refresh(test_case)
    return test_case


@router.delete("/test-cases/{test_case_id}")
async def delete_test_case(test_case_id: UUID, session: AsyncSession = Depends(get_session)):
    """Delete a test case and all related hooks"""
    test_case = await session.get(TestCase, test_case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # First, delete all related test case hooks
    hook_statement = select(TestCaseHook).where(TestCaseHook.test_case_id == test_case_id)
    hook_result = await session.exec(hook_statement)
    hooks = hook_result.all()
    
    for hook in hooks:
        await session.delete(hook)
    
    # Flush to ensure hooks are deleted before deleting test case
    await session.flush()
    
    # Then delete the test case itself
    await session.delete(test_case)
    await session.commit()
    return {"message": "Test case deleted successfully"}


@router.post("/test-cases/{test_case_id}/execute")
async def execute_test_case(
    test_case_id: UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Execute a test case by sending it to the query endpoint"""
    test_case = await session.get(TestCase, test_case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Update test case status to running
    test_case.status = TestCaseStatus.RUNNING
    test_case.last_execution_at = datetime.utcnow()
    session.add(test_case)
    await session.commit()
    await session.refresh(test_case)
    
    # Set Redis client on the service
    test_case_service.set_redis_client(redis_client)
    
    # Execute test case using the service in background
    background_tasks.add_task(
        _execute_test_case_with_service, 
        test_case_id
    )
    
    return {
        "message": "Test case execution started",
        "test_case_id": test_case_id,
        "status": "running"
    }


async def _execute_test_case_with_service(test_case_id: UUID):
    """Execute test case using the test case service"""
    from sqlmodel.ext.asyncio.session import AsyncSession
    from ..deps import engine
    
    try:
        # Create a new async session for this background task
        async with AsyncSession(engine) as session:
            result = await test_case_service.execute_test_case(session, test_case_id)
            return result
    except Exception as e:
        # Update test case status to failed if execution fails
        await _update_test_case_failure(test_case_id, f"Execution failed: {str(e)}")


async def _update_test_case_failure(test_case_id: UUID, error_message: str):
    """Update test case with failure status"""
    from sqlmodel.ext.asyncio.session import AsyncSession
    from ..deps import engine
    
    # Create a new async session for this background task
    async with AsyncSession(engine) as session:
        test_case = await session.get(TestCase, test_case_id)
        if test_case:
            test_case.status = TestCaseStatus.FAILED
            test_case.execution_result = error_message
            session.add(test_case)
            await session.commit()


@router.post("/test-cases/{test_case_id}/execution-result")
async def receive_execution_result(
    test_case_id: UUID,
    result_data: dict,
    session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Webhook endpoint to receive test case execution results and hooks"""
    try:
        print(f"🎯 Received test case webhook for {test_case_id}: {result_data}")
        
        # Set Redis client on the service
        test_case_service.set_redis_client(redis_client)
        
        await test_case_service.process_webhook(session, test_case_id, result_data)
        return {"message": "Execution result received and processed"}
    except Exception as e:
        print(f"❌ Error processing test case webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")


@router.get("/test-cases/{test_case_id}/hooks")
async def get_test_case_hooks(
    test_case_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get hooks for a specific test case"""
    print(f"🔍 Getting hooks for test case {test_case_id}")
    
    test_case = await session.get(TestCase, test_case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    hooks = await test_case_service.get_test_case_hooks(session, test_case_id)
    print(f"✅ Retrieved {len(hooks)} hooks for test case {test_case_id}")
    return {"hooks": hooks}