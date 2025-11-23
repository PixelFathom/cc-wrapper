import logging
import sys
import os
from app.core.grafana_config import setup_structured_logging


# Create a custom filter to block only database logs
class DatabaseLogFilter(logging.Filter):
    def filter(self, record):
        # Block all SQLAlchemy/database logs
        if 'sqlalchemy' in record.name.lower():
            return False
        if 'alembic' in record.name.lower():
            return False
        # Allow all other logs
        return True


def setup_logging():
    """
    Setup logging configuration.
    Uses Grafana structured logging in production, simple logging in development.
    """
    environment = os.getenv("ENVIRONMENT", "development")

    if environment == "production":
        # Use Grafana structured logging in production
        setup_structured_logging()
    else:
        # Use legacy logging for development
        setup_legacy_logging()


def setup_legacy_logging():
    """Legacy logging setup for development environment."""
    # Remove all handlers
    root = logging.getLogger()
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    # Create console handler with custom formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)  # Show all logs at DEBUG level

    # Add database filter to block only database logs
    console_handler.addFilter(DatabaseLogFilter())

    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)

    # Add handler to root logger
    root.addHandler(console_handler)
    root.setLevel(logging.DEBUG)  # Capture all logs at DEBUG level

    # Explicitly disable only SQLAlchemy/database loggers
    logging.getLogger("sqlalchemy").setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.ERROR)
    logging.getLogger("alembic").setLevel(logging.ERROR)

    # Enable all other loggers at INFO level
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.INFO)
    logging.getLogger("httpcore").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("app").setLevel(logging.INFO)