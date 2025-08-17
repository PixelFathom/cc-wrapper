from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "project_mgr"
    
    redis_url: str = "redis://localhost:6379/0"
    
    backend_host: str = "http://localhost:8000"
    
    # Deployment Service``
    org_name: str = "default"
    init_project_url: str = "https://claude.thegetshitdone.ai/init-project"
    webhook_base_url: str = "https://api-code.thegetshitdone.ai"
    query_url: str = "https://claude.thegetshitdone.ai/api/query"
    # External API and file storage
    external_api_url: str = "https://claude.thegetshitdone.ai/api"
    projects_dir: str = "/projects"
    # OpenAI Configuration
    openai_api_key: str = ""
    
    # Clerk Authentication Configuration
    next_public_clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    next_public_clerk_after_sign_out_url: str = "/"
    
    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
