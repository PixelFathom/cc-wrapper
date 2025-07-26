import pytest
from unittest.mock import Mock, patch, AsyncMock
from sqlmodel.ext.asyncio.session import AsyncSession
from uuid import UUID, uuid4
from app.services.chat_service import ChatService
from app.models import Chat, SubProject, Task, Project


@pytest.mark.asyncio
async def test_send_query_includes_bypass_permissions():
    """Test that send_query includes options.permission_mode = 'bypassPermissions' in the payload"""
    
    # Setup
    chat_service = ChatService()
    chat_id = uuid4()
    prompt = "Test prompt"
    session_id = "test-session-123"
    
    # Mock database session and models
    mock_session = AsyncMock(spec=AsyncSession)
    
    # Create mock objects
    mock_chat = Mock(spec=Chat)
    mock_chat.id = chat_id
    mock_chat.sub_project_id = uuid4()
    
    mock_sub_project = Mock(spec=SubProject)
    mock_sub_project.id = mock_chat.sub_project_id
    mock_sub_project.task_id = uuid4()
    
    mock_task = Mock(spec=Task)
    mock_task.id = mock_sub_project.task_id
    mock_task.project_id = uuid4()
    mock_task.name = "test-task"
    
    mock_project = Mock(spec=Project)
    mock_project.id = mock_task.project_id
    mock_project.name = "test-project"
    
    # Setup mock returns
    mock_session.get.side_effect = lambda model_class, id_val: {
        Chat: mock_chat,
        SubProject: mock_sub_project,
        Task: mock_task,
        Project: mock_project
    }.get(model_class)
    
    # Mock httpx client
    with patch('app.services.chat_service.httpx.AsyncClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "session_id": session_id,
            "assistant_response": "Test response",
            "task_id": "task-123"
        }
        mock_client.post.return_value = mock_response
        
        # Execute
        result = await chat_service.send_query(mock_session, chat_id, prompt, session_id)
        
        # Verify the request was made with correct payload
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        
        # Extract the payload from the call
        payload = call_args[1]['json']
        
        # Assert options field exists with correct value
        assert 'options' in payload
        assert payload['options']['permission_mode'] == 'bypassPermissions'
        
        # Verify other required fields are present
        assert payload['prompt'] == prompt
        assert payload['session_id'] == session_id
        assert 'webhook_url' in payload
        assert 'organization_name' in payload
        assert 'project_path' in payload
        assert 'conversation_id' in payload


@pytest.mark.asyncio
async def test_send_query_logs_bypass_mode():
    """Test that send_query logs the bypass permission mode"""
    
    # Setup
    chat_service = ChatService()
    chat_id = uuid4()
    prompt = "Test prompt"
    
    # Mock database session and models (same as above)
    mock_session = AsyncMock(spec=AsyncSession)
    
    mock_chat = Mock(spec=Chat)
    mock_chat.id = chat_id
    mock_chat.sub_project_id = uuid4()
    
    mock_sub_project = Mock(spec=SubProject)
    mock_sub_project.id = mock_chat.sub_project_id
    mock_sub_project.task_id = uuid4()
    
    mock_task = Mock(spec=Task)
    mock_task.id = mock_sub_project.task_id
    mock_task.project_id = uuid4()
    mock_task.name = "test-task"
    
    mock_project = Mock(spec=Project)
    mock_project.id = mock_task.project_id
    mock_project.name = "test-project"
    
    mock_session.get.side_effect = lambda model_class, id_val: {
        Chat: mock_chat,
        SubProject: mock_sub_project,
        Task: mock_task,
        Project: mock_project
    }.get(model_class)
    
    # Mock httpx and logger
    with patch('app.services.chat_service.httpx.AsyncClient') as mock_client_class, \
         patch('app.services.chat_service.logger') as mock_logger:
        
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "session_id": "session-123",
            "assistant_response": "Test response"
        }
        mock_client.post.return_value = mock_response
        
        # Execute
        await chat_service.send_query(mock_session, chat_id, prompt)
        
        # Verify logger was called with bypass permissions info
        log_calls = [call for call in mock_logger.info.call_args_list 
                     if 'permission_mode=bypassPermissions' in str(call)]
        assert len(log_calls) > 0, "Expected logger to log permission_mode=bypassPermissions"