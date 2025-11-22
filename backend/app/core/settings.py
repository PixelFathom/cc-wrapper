from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "project_mgr"

    redis_url: str = "redis://localhost:6379/0"

    backend_host: str = "https://code-api.tanmaydeepsharma.com"

    # Deployment Service``
    org_name: str = "default"
    init_project_url: str = "https://claude.tanmaydeepsharma.com/init-project"
    webhook_base_url: str = "https://code-api.tanmaydeepsharma.com"
    query_url: str = "https://claude.tanmaydeepsharma.com/api/query"
    # External API and file storage
    external_api_url: str = "https://claude.tanmaydeepsharma.com/api"
    # Nginx API
    nginx_api_url: str = "https://claude.tanmaydeepsharma.com/api/nginx"
    # OpenAI Configuration
    openai_api_key: str = ""


    github_client_id: str = "Ov23liOgTbsMxWYl7m9c"
    github_client_secret: str = "8694366578ea74ab63651c86cef553daf16f6243"
    github_oauth_callback_url: str = "https://code.tanmaydeepsharma.com/auth/github/callback"

    # Encryption key for token storage (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    encryption_key: str = ""
    secret_key: str = "default-secret-change-in-production"

    # Cashfree Payment Gateway Configuration
    # Using TEST credentials for development
    # Note: Webhook signature verification uses cashfree_secret_key (not a separate webhook secret)
    cashfree_app_id: str = "TEST108891343319313d7a4fe5b68f0943198801"
    cashfree_secret_key: str = "cfsk_ma_test_2c60475663019dc457a7e1c6e363bd06_b6126c7b"
    cashfree_api_version: str = "2023-08-01"
    cashfree_environment: str = "sandbox"  # sandbox or production

    # Hostinger DNS API Configuration
    hostinger_api_token: str = ""
    hostinger_domain: str = ""  # e.g., "example.com"
    hostinger_api_base_url: str = "https://developers.hostinger.com"

    # Hosting Configuration
    server_ip: str = "149.5.247.109"  # Target IP for A records
    default_dns_ttl: int = 300  # TTL in seconds


    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
