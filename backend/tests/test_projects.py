import pytest
from httpx import AsyncClient
from sqlmodel import Session
from app.main import app
from app.models import Project


@pytest.mark.asyncio
async def test_create_project():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/projects",
            json={
                "name": "Test Project",
                "repo_url": "https://github.com/test/repo"
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["repo_url"] == "https://github.com/test/repo"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_projects():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create a project first
        await client.post(
            "/api/projects",
            json={
                "name": "Test Project",
                "repo_url": "https://github.com/test/repo"
            }
        )
        
        # List projects
        response = await client.get("/api/projects")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0