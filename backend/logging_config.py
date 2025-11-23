import logging
import sys
import os

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
    # Remove all handlers
    root = logging.getLogger()
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    # Get configuration from environment
    better_stack_token = os.getenv('BETTER_STACK_SOURCE_TOKEN', '')
    better_stack_host = os.getenv('BETTER_STACK_HOST', 'https://in.logs.betterstack.com')
    better_stack_enabled = os.getenv('BETTER_STACK_ENABLED', 'true').lower() == 'true'
    log_level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Create console handler with custom formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.addFilter(DatabaseLogFilter())
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    # Add Better Stack handler if configured
    if better_stack_enabled and better_stack_token:
        try:
            from logtail import LogtailHandler

            better_stack_handler = LogtailHandler(
                source_token=better_stack_token,
                host=better_stack_host
            )
            better_stack_handler.setLevel(log_level)
            better_stack_handler.addFilter(DatabaseLogFilter())
            root.addHandler(better_stack_handler)

            print(f"✓ Better Stack logging enabled (level: {log_level_str})")
        except ImportError:
            print("⚠ logtail-python not installed, Better Stack logging disabled")
        except Exception as e:
            print(f"⚠ Failed to initialize Better Stack logging: {e}")
    else:
        if not better_stack_token:
            print("⚠ Better Stack logging disabled: BETTER_STACK_SOURCE_TOKEN not set")
        else:
            print("⚠ Better Stack logging disabled via BETTER_STACK_ENABLED=false")

    root.setLevel(logging.DEBUG)  # Capture all logs at DEBUG level

    # Explicitly disable only SQLAlchemy/database loggers
    logging.getLogger("sqlalchemy").setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.ERROR)
    logging.getLogger("alembic").setLevel(logging.ERROR)

    # Enable all other loggers at configured level
    logging.getLogger("uvicorn").setLevel(log_level)
    logging.getLogger("uvicorn.access").setLevel(log_level)
    logging.getLogger("httpx").setLevel(log_level)
    logging.getLogger("httpcore").setLevel(log_level)
    logging.getLogger("fastapi").setLevel(log_level)
    logging.getLogger("app").setLevel(log_level)