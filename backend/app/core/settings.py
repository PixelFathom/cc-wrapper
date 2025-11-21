from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "project_mgr"

    redis_url: str = "redis://localhost:6379/0"

    backend_host: str = "http://localhost:9000"

    # Deployment Service``
    org_name: str = "default"
    init_project_url: str = "htttps://claude.tanmaydeepsharma.com/init-project"
    webhook_base_url: str = "http://localhost:9000"
    query_url: str = "htttps://claude.tanmaydeepsharma.com/api/query"
    # External API and file storage
    external_api_url: str = "htttps://claude.tanmaydeepsharma.com/api"
    # Nginx API
    nginx_api_url: str = "htttps://claude.tanmaydeepsharma.com/api/nginx"
    # OpenAI Configuration
    openai_api_key: str = ""

    github_client_id: str = "Ov23liopoy2CEwpxsNdn"
    github_client_secret: str = "b6a071f4aa6f7563c4e1c539d66facee69891fdf"
    github_oauth_callback_url: str = "http://localhost:2000/auth/github/callback"

    # Encryption key for token storage (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    encryption_key: str = ""
    secret_key: str = "default-secret-change-in-production"

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
