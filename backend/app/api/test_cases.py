from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
import httpx
import redis.asyncio as redis

from ..deps import get_session, get_redis_client
from ..models.test_case import (
    TestCase, TestCaseStatus, TestCaseCreate, TestCaseUpdate, TestCaseRead, 
    TestCaseExecutionRequest, TestCaseGenerationRequest, TestCaseGenerationResponse
)
from ..models.test_case_hook import TestCaseHook
from ..services.test_case_service import test_case_service
from ..services.test_generation_service import test_generation_service
from ..core.settings import get_settings

router = APIRouter()


@router.get("/tasks/{task_id}/test-cases", response_model=List[TestCaseRead])
async def get_test_cases(task_id: UUID, session: AsyncSession = Depends(get_session)):
    """Get all test cases for a task"""
    statement = select(TestCase).where(TestCase.task_id == task_id)
    result = await session.exec(statement)
    test_cases = result.all()
    return test_cases


@router.get("/tasks/{task_id}/test-cases/grouped")
async def get_test_cases_grouped_by_session(task_id: UUID, session: AsyncSession = Depends(get_session)):
    """Get all test cases for a task grouped by session_id"""
    statement = select(TestCase).where(TestCase.task_id == task_id)
    result = await session.exec(statement)
    test_cases = result.all()
    
    # Group test cases by session_id
    grouped: Dict[Optional[str], List[Dict[str, Any]]] = {}
    
    for test_case in test_cases:
        session_key = test_case.session_id or "manual"
        
        if session_key not in grouped:
            grouped[session_key] = []
        
        # Convert test case to dict
        test_case_dict = {
            "id": str(test_case.id),
            "title": test_case.title,
            "description": test_case.description,
            "test_steps": test_case.test_steps,
            "expected_result": test_case.expected_result,
            "status": test_case.status.value,
            "last_execution_at": test_case.last_execution_at.isoformat() if test_case.last_execution_at else None,
            "execution_result": test_case.execution_result,
            "task_id": str(test_case.task_id),
            "created_at": test_case.created_at.isoformat(),
            "source": test_case.source.value,
            "session_id": test_case.session_id,
            "generated_from_messages": test_case.generated_from_messages,
            "ai_model_used": test_case.ai_model_used
        }
        
        grouped[session_key].append(test_case_dict)
    
    # Transform grouped data into a more frontend-friendly structure
    sessions = []
    for session_id, cases in grouped.items():
        session_info = {
            "session_id": session_id,
            "display_name": f"Session: {session_id[:8]}..." if session_id != "manual" and len(session_id) > 8 else session_id.capitalize(),
            "test_case_count": len(cases),
            "test_cases": sorted(cases, key=lambda x: x["created_at"], reverse=True),
            "is_ai_generated": session_id != "manual",
            "latest_execution": max(
                (tc["last_execution_at"] for tc in cases if tc["last_execution_at"]), 
                default=None
            )
        }
        sessions.append(session_info)
    
    # Sort sessions: manual first, then others by latest creation date (newest first)
    manual_sessions = [s for s in sessions if s["session_id"] == "manual"]
    other_sessions = [s for s in sessions if s["session_id"] != "manual"]
    
    # Sort non-manual sessions by latest test case creation date (newest first)
    other_sessions.sort(
        key=lambda x: max((tc["created_at"] for tc in x["test_cases"]), default="") if x["test_cases"] else "",
        reverse=True
    )
    
    # Combine: manual sessions first, then sorted others
    sessions = manual_sessions + other_sessions
    
    return {
        "task_id": str(task_id),
        "total_test_cases": len(test_cases),
        "session_count": len(sessions),
        "sessions": sessions
    }


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


@router.post("/sessions/{session_id}/generate-test-cases", response_model=TestCaseGenerationResponse)
async def generate_test_cases_from_session(
    session_id: str,
    request: TestCaseGenerationRequest,
    db_session: AsyncSession = Depends(get_session)
):
    """Generate test cases from a chat session using AI"""
    try:
        print(f"🤖 Generating test cases for session {session_id}")
        
        # Use the session_id from the request body
        result = await test_generation_service.generate_test_cases_from_session(
            db_session,
            request.session_id,
            request.max_test_cases or 5,
            request.focus_areas
        )
        
        print(f"✅ Generated {result['generated_count']} test cases")
        
        return TestCaseGenerationResponse(
            generated_count=result['generated_count'],
            test_cases=[TestCaseRead(**case) for case in result['test_cases']],
            generation_summary=result['generation_summary']
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error generating test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating test cases: {str(e)}")


@router.post("/sessions/{session_id}/test-cases/generate-and-execute")
async def generate_and_execute_test_cases(
    session_id: str,
    request: TestCaseGenerationRequest,
    background_tasks: BackgroundTasks,
    db_session: AsyncSession = Depends(get_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """Generate test cases from session and execute them immediately"""
    try:
        print(f"🚀 Generating and executing test cases for session {session_id}")
        
        # Generate test cases first
        result = await test_generation_service.generate_test_cases_from_session(
            db_session,
            request.session_id,
            request.max_test_cases or 5,
            request.focus_areas
        )
        
        print(f"✅ Generated {result['generated_count']} test cases, starting execution")
        
        # Set Redis client on the service
        test_case_service.set_redis_client(redis_client)
        
        # Execute each test case in background
        executed_cases = []
        for test_case in result['test_cases']:
            test_case_id = UUID(test_case['id'])
            
            # Update status to running
            db_test_case = await db_session.get(TestCase, test_case_id)
            if db_test_case:
                db_test_case.status = TestCaseStatus.RUNNING
                db_test_case.last_execution_at = datetime.utcnow()
                db_session.add(db_test_case)
            
            # Add to background execution
            background_tasks.add_task(
                _execute_test_case_with_service,
                test_case_id
            )
            
            executed_cases.append(test_case_id)
        
        await db_session.commit()
        
        return {
            'message': 'Test cases generated and execution started',
            'generated_count': result['generated_count'],
            'executing_test_case_ids': [str(tc_id) for tc_id in executed_cases],
            'generation_summary': result['generation_summary']
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error generating and executing test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")