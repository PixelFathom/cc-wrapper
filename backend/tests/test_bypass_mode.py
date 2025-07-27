import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.services.chat_service import ChatService
from uuid import uuid4


@pytest.mark.asyncio
async def test_bypass_mode_parameter_handling():
    """Test that bypass_mode parameter is correctly handled in send_query"""
    
    chat_service = ChatService()
    chat_id = uuid4()
    
    # Mock the database session and related objects
    mock_db = AsyncMock()
    mock_chat = Mock()
    mock_chat.sub_project_id = uuid4()
    mock_sub_project = Mock()
    mock_sub_project.task_id = uuid4()
    mock_task = Mock()
    mock_task.name = "test-task"
    mock_task.id = uuid4()
    mock_project = Mock()
    mock_project.name = "test-project"
    
    # Setup the mock returns
    mock_db.get.side_effect = lambda model, id: {
        chat_id: mock_chat,
        mock_chat.sub_project_id: mock_sub_project,
        mock_sub_project.task_id: mock_task,
        mock_task.project_id: mock_project
    }.get(id)
    
    # Mock httpx client
    with patch('app.services.chat_service.httpx.AsyncClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "session_id": "test-session",
            "assistant_response": "Test response"
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test Case 1: bypass_mode = True (should send "bypassPermissions")
        await chat_service.send_query(mock_db, chat_id, "test prompt", bypass_mode=True)
        
        call_args = mock_client.post.call_args[1]['json']
        assert call_args['options']['permission_mode'] == "bypassPermissions"
        
        # Test Case 2: bypass_mode = False (should send "interactive")
        await chat_service.send_query(mock_db, chat_id, "test prompt", bypass_mode=False)
        
        call_args = mock_client.post.call_args[1]['json']
        assert call_args['options']['permission_mode'] == "interactive"
        
        # Test Case 3: bypass_mode = None (should send "interactive" - default)
        await chat_service.send_query(mock_db, chat_id, "test prompt", bypass_mode=None)
        
        call_args = mock_client.post.call_args[1]['json']
        assert call_args['options']['permission_mode'] == "interactive"
        
        # Test Case 4: bypass_mode not provided (should send "interactive" - default)
        await chat_service.send_query(mock_db, chat_id, "test prompt")
        
        call_args = mock_client.post.call_args[1]['json']
        assert call_args['options']['permission_mode'] == "interactive"


def test_permission_mode_logic():
    """Test the permission_mode logic directly"""
    
    # Test different values of bypass_mode
    test_cases = [
        (True, "bypassPermissions"),
        (False, "interactive"),
        (None, "interactive"),
        (1, "bypassPermissions"),  # Truthy value
        (0, "interactive"),        # Falsy value
        ("", "interactive"),       # Falsy value
        ("yes", "bypassPermissions"),  # Truthy value
    ]
    
    for bypass_mode, expected in test_cases:
        result = "bypassPermissions" if bypass_mode is True else "interactive"
        assert result == expected, f"Failed for bypass_mode={bypass_mode}: expected {expected}, got {result}"