"""
Grafana Cloud integration configuration for logging and metrics.
"""
import os
import logging
import structlog
from typing import Optional, Dict, Any
import json
from datetime import datetime
import asyncio
import aiohttp
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest


# Grafana Cloud configuration from environment
GRAFANA_LOKI_URL = os.getenv("GRAFANA_LOKI_URL", "https://logs-prod-028.grafana.net/loki/api/v1/push")
GRAFANA_LOKI_USER = os.getenv("GRAFANA_LOKI_USER", "1404926")
GRAFANA_LOKI_API_KEY = os.getenv("GRAFANA_LOKI_API_KEY")
GRAFANA_PROMETHEUS_URL = os.getenv("GRAFANA_PROMETHEUS_URL", "https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push")
GRAFANA_PROMETHEUS_USER = os.getenv("GRAFANA_PROMETHEUS_USER", "2818499")
GRAFANA_PROMETHEUS_API_KEY = os.getenv("GRAFANA_PROMETHEUS_API_KEY")

# Application labels
APP_NAME = os.getenv("APP_NAME", "cc-wrapper")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
INSTANCE_NAME = os.getenv("INSTANCE_NAME", "cc-wrapper-1")


class GrafanaLokiHandler(logging.Handler):
    """Custom logging handler that sends logs to Grafana Cloud Loki."""

    def __init__(self):
        super().__init__()
        self.loki_url = GRAFANA_LOKI_URL
        self.auth = (GRAFANA_LOKI_USER, GRAFANA_LOKI_API_KEY) if GRAFANA_LOKI_API_KEY else None
        self.labels = {
            "app": APP_NAME,
            "environment": ENVIRONMENT,
            "instance": INSTANCE_NAME,
            "service": "backend"
        }
        self.session = None

    async def _get_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()
        return self.session

    def format_for_loki(self, record):
        """Format log record for Loki ingestion."""
        # Create timestamp in nanoseconds
        timestamp = str(int(record.created * 1_000_000_000))

        # Create log line with structured data
        log_data = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "module": getattr(record, 'module', ''),
            "function": getattr(record, 'funcName', ''),
            "line": getattr(record, 'lineno', ''),
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                          'filename', 'module', 'lineno', 'funcName', 'created', 'msecs',
                          'relativeCreated', 'thread', 'threadName', 'processName', 'process',
                          'getMessage', 'exc_info', 'exc_text', 'stack_info']:
                log_data[key] = str(value)

        return timestamp, json.dumps(log_data)

    def emit(self, record):
        """Emit log record to Loki (async)."""
        if not self.auth:
            return  # Skip if no API key configured

        try:
            timestamp, log_line = self.format_for_loki(record)

            # Create Loki payload
            payload = {
                "streams": [
                    {
                        "stream": self.labels,
                        "values": [[timestamp, log_line]]
                    }
                ]
            }

            # Send async (fire-and-forget to avoid blocking)
            asyncio.create_task(self._send_to_loki(payload))

        except Exception as e:
            # Fallback to console if Loki fails
            print(f"Failed to send log to Loki: {e}")

    async def _send_to_loki(self, payload):
        """Send payload to Loki."""
        try:
            session = await self._get_session()
            headers = {
                "Content-Type": "application/json"
            }

            async with session.post(
                self.loki_url,
                json=payload,
                headers=headers,
                auth=aiohttp.BasicAuth(self.auth[0], self.auth[1]) if self.auth else None,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status >= 400:
                    print(f"Loki returned status {response.status}: {await response.text()}")

        except Exception as e:
            print(f"Error sending to Loki: {e}")


# Prometheus metrics
prometheus_registry = CollectorRegistry()

# API metrics
api_requests_total = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status_code'],
    registry=prometheus_registry
)

api_request_duration = Histogram(
    'api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint'],
    registry=prometheus_registry
)

active_connections = Gauge(
    'active_connections',
    'Number of active connections',
    registry=prometheus_registry
)

database_connections = Gauge(
    'database_connections_active',
    'Active database connections',
    registry=prometheus_registry
)

redis_connections = Gauge(
    'redis_connections_active',
    'Active Redis connections',
    registry=prometheus_registry
)

# Chat metrics
chat_sessions_active = Gauge(
    'chat_sessions_active',
    'Number of active chat sessions',
    registry=prometheus_registry
)

chat_messages_total = Counter(
    'chat_messages_total',
    'Total chat messages processed',
    ['session_id'],
    registry=prometheus_registry
)

# File upload metrics
file_uploads_total = Counter(
    'file_uploads_total',
    'Total file uploads',
    ['file_type', 'status'],
    registry=prometheus_registry
)

file_upload_size_bytes = Histogram(
    'file_upload_size_bytes',
    'File upload sizes in bytes',
    registry=prometheus_registry
)


def setup_structured_logging():
    """Setup structured logging with Grafana Loki integration."""

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if ENVIRONMENT == "development" else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.WriteLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Setup root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Add console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    if ENVIRONMENT == "production":
        # Use JSON formatter for production
        import pythonjsonlogger.jsonlogger
        json_formatter = pythonjsonlogger.jsonlogger.JsonFormatter(
            '%(asctime)s %(name)s %(levelname)s %(message)s'
        )
        console_handler.setFormatter(json_formatter)

        # Add Loki handler if configured
        if GRAFANA_LOKI_API_KEY:
            loki_handler = GrafanaLokiHandler()
            loki_handler.setLevel(logging.INFO)
            root_logger.addHandler(loki_handler)
    else:
        # Use simple formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)

    root_logger.addHandler(console_handler)

    # Configure specific loggers
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


async def push_metrics_to_grafana():
    """Push Prometheus metrics to Grafana Cloud (called periodically)."""
    if not GRAFANA_PROMETHEUS_API_KEY:
        return

    try:
        # Generate metrics in Prometheus format
        metrics_data = generate_latest(prometheus_registry)

        # Convert to remote write format (simplified)
        # In production, you'd want to use the actual Prometheus remote write protocol
        # For now, we'll use the metrics endpoint

        headers = {
            "Content-Type": "application/x-protobuf",
            "Content-Encoding": "snappy",
            "X-Prometheus-Remote-Write-Version": "0.1.0"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                GRAFANA_PROMETHEUS_URL,
                data=metrics_data,
                headers=headers,
                auth=aiohttp.BasicAuth(GRAFANA_PROMETHEUS_USER, GRAFANA_PROMETHEUS_API_KEY),
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status >= 400:
                    logging.warning(f"Failed to push metrics to Grafana: {response.status}")

    except Exception as e:
        logging.error(f"Error pushing metrics to Grafana: {e}")


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


# Export metrics objects for use in application
__all__ = [
    'setup_structured_logging',
    'get_logger',
    'push_metrics_to_grafana',
    'api_requests_total',
    'api_request_duration',
    'active_connections',
    'database_connections',
    'redis_connections',
    'chat_sessions_active',
    'chat_messages_total',
    'file_uploads_total',
    'file_upload_size_bytes',
    'prometheus_registry'
]