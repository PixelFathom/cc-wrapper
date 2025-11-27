"""
Test script for sub-task pipeline execution.

Tests that when a sub-task is completed, the next sub-task
automatically starts executing.
"""
import asyncio
import pytest
from uuid import uuid4
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import sys
sys.path.insert(0, '/Users/tanmaydeepsharma/workspace/cfpj/backend')

from app.services.task_orchestration_service import TaskOrchestrationService
from app.services.task_analysis_service import BreakdownAnalysis, SubTaskSpec


class MockChat:
    """Mock Chat object for testing"""
    def __init__(self, id=None, sub_project_id=None, session_id=None,
                 parent_session_id=None, role="user", content=None):
        self.id = id or uuid4()
        self.sub_project_id = sub_project_id or uuid4()
        self.session_id = session_id or str(uuid4())
        self.parent_session_id = parent_session_id
        self.role = role
        self.content = content or {"text": "test", "metadata": {}}


class MockDBSession:
    """Mock database session for testing"""
    def __init__(self):
        self.added_objects = []
        self.committed = False
        self.refreshed_objects = []
        self._data = {}

    def add(self, obj):
        self.added_objects.append(obj)

    async def commit(self):
        self.committed = True

    async def flush(self):
        # Assign IDs to new objects
        for obj in self.added_objects:
            if hasattr(obj, 'id') and obj.id is None:
                obj.id = uuid4()

    async def refresh(self, obj):
        self.refreshed_objects.append(obj)

    async def execute(self, stmt):
        return MockResult()

    async def get(self, model, id):
        return self._data.get(str(id))


class MockResult:
    """Mock query result"""
    def __init__(self, value=None):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return MockScalars([])

    def all(self):
        return []

    def first(self):
        return None


class MockScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


@pytest.fixture
def orchestration_service():
    return TaskOrchestrationService()


@pytest.fixture
def mock_db():
    return MockDBSession()


@pytest.fixture
def sample_analysis():
    """Create a sample breakdown analysis with 3 sub-tasks"""
    return BreakdownAnalysis(
        should_breakdown=True,
        reasoning="This is a multi-step task that requires sequential execution",
        sub_tasks=[
            SubTaskSpec(
                sequence=1,
                title="Create API endpoint",
                description="Create the REST API endpoint for user registration",
                testing_requirements="Unit test the endpoint"
            ),
            SubTaskSpec(
                sequence=2,
                title="Add validation",
                description="Add input validation for the registration form",
                testing_requirements="Test validation rules"
            ),
            SubTaskSpec(
                sequence=3,
                title="Write tests",
                description="Write comprehensive tests for the registration flow",
                testing_requirements="Achieve 80% coverage"
            )
        ]
    )


@pytest.fixture
def parent_chat():
    """Create a parent chat with breakdown metadata"""
    chat = MockChat(
        id=uuid4(),
        session_id=str(uuid4()),
        role="user",
        content={
            "text": "Create a user registration system with validation and tests",
            "metadata": {}
        }
    )
    return chat


class TestSubTaskPipeline:
    """Test suite for sub-task pipeline execution"""

    @pytest.mark.asyncio
    async def test_create_breakdown_sessions_creates_all_subtasks(
        self, orchestration_service, mock_db, parent_chat, sample_analysis
    ):
        """Test that create_breakdown_sessions creates all sub-task sessions upfront"""
        with patch.object(
            orchestration_service,
            '_TaskOrchestrationService__generate_prompts',
            new_callable=AsyncMock
        ) as mock_gen:
            # Mock the task analysis service
            with patch('app.services.task_orchestration_service.task_analysis_service') as mock_analysis:
                mock_analysis.generate_sub_task_prompts = AsyncMock(return_value=[
                    {
                        "sequence": 1,
                        "title": "Create API endpoint",
                        "description": "Create REST API",
                        "prompt": "Create a REST API endpoint...",
                        "testing_requirements": "Unit test"
                    },
                    {
                        "sequence": 2,
                        "title": "Add validation",
                        "description": "Add input validation",
                        "prompt": "Add input validation...",
                        "testing_requirements": "Test validation"
                    },
                    {
                        "sequence": 3,
                        "title": "Write tests",
                        "description": "Write tests",
                        "prompt": "Write comprehensive tests...",
                        "testing_requirements": "80% coverage"
                    }
                ])

                result = await orchestration_service.create_breakdown_sessions(
                    mock_db,
                    parent_chat,
                    sample_analysis,
                    context={"project_name": "Test Project"}
                )

                # Verify breakdown metadata was created
                assert result is not None
                assert result.get("is_breakdown_parent") == True
                assert result.get("total_sub_tasks") == 3
                assert result.get("completed_sub_tasks") == 0

                # Verify all sub-task sessions were created
                sub_task_sessions = result.get("sub_task_sessions", [])
                assert len(sub_task_sessions) == 3

                # Verify session linking (next_session_id)
                assert sub_task_sessions[0].get("next_session_id") is not None
                assert sub_task_sessions[1].get("next_session_id") is not None
                assert sub_task_sessions[2].get("next_session_id") is None  # Last task

                # Verify all tasks are pending
                for task in sub_task_sessions:
                    assert task.get("status") == "pending"

    @pytest.mark.asyncio
    async def test_handle_sub_task_completion_returns_true_for_more_tasks(
        self, orchestration_service
    ):
        """Test that handle_sub_task_completion returns True when there are more pending tasks"""
        parent_session_id = str(uuid4())
        child_session_id = str(uuid4())

        # Create a parent chat with breakdown metadata
        parent_chat = MockChat(
            session_id=parent_session_id,
            role="user",
            content={
                "text": "Parent task",
                "metadata": {
                    "is_breakdown_parent": True,
                    "total_sub_tasks": 3,
                    "completed_sub_tasks": 0,
                    "sub_task_sessions": [
                        {"sequence": 1, "session_id": child_session_id, "status": "processing"},
                        {"sequence": 2, "session_id": str(uuid4()), "status": "pending"},
                        {"sequence": 3, "session_id": str(uuid4()), "status": "pending"}
                    ]
                }
            }
        )

        # Create a completed assistant chat (child task)
        completed_chat = MockChat(
            session_id=child_session_id,
            parent_session_id=parent_session_id,
            role="assistant",
            content={"text": "Task 1 completed successfully"}
        )

        # Mock database to return the parent chat
        mock_db = MockDBSession()

        with patch.object(mock_db, 'execute') as mock_execute:
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = parent_chat
            mock_execute.return_value = mock_result

            result = await orchestration_service.handle_sub_task_completion(
                mock_db, completed_chat
            )

            # Should return True since there are more pending tasks
            assert result == True

    @pytest.mark.asyncio
    async def test_handle_sub_task_completion_returns_false_when_all_done(
        self, orchestration_service
    ):
        """Test that handle_sub_task_completion returns False when all tasks are done"""
        parent_session_id = str(uuid4())
        child_session_id = str(uuid4())

        # Create a parent chat where all tasks except one are completed
        parent_chat = MockChat(
            session_id=parent_session_id,
            role="user",
            content={
                "text": "Parent task",
                "metadata": {
                    "is_breakdown_parent": True,
                    "total_sub_tasks": 2,
                    "completed_sub_tasks": 1,
                    "sub_task_sessions": [
                        {"sequence": 1, "session_id": str(uuid4()), "status": "completed"},
                        {"sequence": 2, "session_id": child_session_id, "status": "processing"}
                    ]
                }
            }
        )

        # Create a completed assistant chat (the last child task)
        completed_chat = MockChat(
            session_id=child_session_id,
            parent_session_id=parent_session_id,
            role="assistant",
            content={"text": "Task 2 completed"}
        )

        mock_db = MockDBSession()

        with patch.object(mock_db, 'execute') as mock_execute:
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = parent_chat
            mock_execute.return_value = mock_result

            result = await orchestration_service.handle_sub_task_completion(
                mock_db, completed_chat
            )

            # Should return False since all tasks are now complete
            assert result == False

    @pytest.mark.asyncio
    async def test_start_next_sub_task_returns_pending_task_info(
        self, orchestration_service
    ):
        """Test that start_next_sub_task returns info for the first pending task"""
        parent_session_id = str(uuid4())
        pending_session_id = str(uuid4())
        pending_chat_id = str(uuid4())
        sub_project_id = uuid4()

        # Create parent chat with one completed and one pending task
        parent_chat = MockChat(
            sub_project_id=sub_project_id,
            session_id=parent_session_id,
            role="user",
            content={
                "text": "Parent task",
                "metadata": {
                    "is_breakdown_parent": True,
                    "total_sub_tasks": 2,
                    "completed_sub_tasks": 1,
                    "current_sub_task": 0,
                    "sub_task_sessions": [
                        {"sequence": 1, "session_id": str(uuid4()), "status": "completed"},
                        {
                            "sequence": 2,
                            "session_id": pending_session_id,
                            "chat_id": pending_chat_id,
                            "status": "pending",
                            "title": "Add validation",
                            "description": "Add input validation",
                            "prompt": "Add input validation for..."
                        }
                    ]
                }
            }
        )

        # Mock the pending sub-task chat
        pending_chat = MockChat(
            id=uuid4(),
            session_id=pending_session_id,
            role="user"
        )

        mock_db = MockDBSession()
        mock_db._data[pending_chat_id] = pending_chat

        with patch.object(mock_db, 'execute') as mock_execute:
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = parent_chat
            mock_execute.return_value = mock_result

            with patch.object(mock_db, 'get', return_value=pending_chat):
                result = await orchestration_service.start_next_sub_task(
                    mock_db, parent_session_id, sub_project_id
                )

                # Verify task info is returned
                assert result is not None
                assert result.get("session_id") == pending_session_id
                assert result.get("sequence") == 2
                assert result.get("title") == "Add validation"

    @pytest.mark.asyncio
    async def test_pipeline_executes_tasks_sequentially(self, orchestration_service):
        """Integration test: verify full pipeline executes tasks in order"""
        parent_session_id = str(uuid4())
        sub_project_id = uuid4()

        # Generate session IDs for 3 sub-tasks
        session_ids = [str(uuid4()) for _ in range(3)]
        chat_ids = [str(uuid4()) for _ in range(3)]

        # Create parent chat with all pending sub-tasks
        parent_content = {
            "text": "Create a complete feature",
            "metadata": {
                "is_breakdown_parent": True,
                "total_sub_tasks": 3,
                "completed_sub_tasks": 0,
                "current_sub_task": 0,
                "sub_task_sessions": [
                    {
                        "sequence": i + 1,
                        "session_id": session_ids[i],
                        "chat_id": chat_ids[i],
                        "next_session_id": session_ids[i + 1] if i < 2 else None,
                        "status": "pending",
                        "title": f"Task {i + 1}",
                        "description": f"Description {i + 1}",
                        "prompt": f"Execute task {i + 1}"
                    }
                    for i in range(3)
                ]
            }
        }

        parent_chat = MockChat(
            sub_project_id=sub_project_id,
            session_id=parent_session_id,
            role="user",
            content=parent_content
        )

        mock_db = MockDBSession()

        # Simulate the pipeline execution
        execution_order = []

        for task_idx in range(3):
            # Start next sub-task
            with patch.object(mock_db, 'execute') as mock_execute:
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = parent_chat
                mock_execute.return_value = mock_result

                sub_task_chat = MockChat(
                    id=uuid4(),
                    session_id=session_ids[task_idx],
                    role="user"
                )

                with patch.object(mock_db, 'get', return_value=sub_task_chat):
                    task_info = await orchestration_service.start_next_sub_task(
                        mock_db, parent_session_id, sub_project_id
                    )

                    if task_info:
                        execution_order.append(task_info["sequence"])

                        # Update parent_chat to reflect task started (processing)
                        parent_chat.content["metadata"]["sub_task_sessions"][task_idx]["status"] = "processing"

            # Simulate task completion
            completed_chat = MockChat(
                session_id=session_ids[task_idx],
                parent_session_id=parent_session_id,
                sub_project_id=sub_project_id,
                role="assistant",
                content={"text": f"Task {task_idx + 1} completed"}
            )

            with patch.object(mock_db, 'execute') as mock_execute:
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = parent_chat
                mock_execute.return_value = mock_result

                should_continue = await orchestration_service.handle_sub_task_completion(
                    mock_db, completed_chat
                )

                # Update parent_chat to reflect completion
                parent_chat.content["metadata"]["sub_task_sessions"][task_idx]["status"] = "completed"
                parent_chat.content["metadata"]["completed_sub_tasks"] += 1

                # Verify should_continue is True for tasks 1 and 2, False for task 3
                if task_idx < 2:
                    assert should_continue == True, f"Should continue after task {task_idx + 1}"
                else:
                    assert should_continue == False, "Should not continue after last task"

        # Verify tasks executed in order
        assert execution_order == [1, 2, 3], f"Expected [1, 2, 3], got {execution_order}"
        print("✅ Pipeline executed tasks in correct order: 1 -> 2 -> 3")


def run_tests():
    """Run all tests"""
    pytest.main([__file__, '-v', '-s'])


if __name__ == "__main__":
    run_tests()
