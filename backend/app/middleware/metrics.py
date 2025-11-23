"""
Prometheus metrics middleware for FastAPI application.
"""
import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.grafana_config import (
    api_requests_total,
    api_request_duration,
    active_connections,
    get_logger
)

logger = get_logger(__name__)


class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect Prometheus metrics for API requests."""

    def __init__(self, app, collect_metrics: bool = True):
        super().__init__(app)
        self.collect_metrics = collect_metrics
        self.active_requests = 0

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.collect_metrics:
            return await call_next(request)

        # Start timing
        start_time = time.time()
        self.active_requests += 1
        active_connections.set(self.active_requests)

        # Extract request info
        method = request.method
        path = request.url.path

        # Normalize path for metrics (remove IDs)
        normalized_path = self._normalize_path(path)

        try:
            # Process request
            response = await call_next(request)

            # Record metrics
            status_code = str(response.status_code)

            # Increment request counter
            api_requests_total.labels(
                method=method,
                endpoint=normalized_path,
                status_code=status_code
            ).inc()

            # Record request duration
            duration = time.time() - start_time
            api_request_duration.labels(
                method=method,
                endpoint=normalized_path
            ).observe(duration)

            # Log request info (structured logging)
            logger.info(
                "API request completed",
                method=method,
                path=path,
                status_code=response.status_code,
                duration=duration,
                user_agent=request.headers.get("user-agent", ""),
                client_ip=self._get_client_ip(request)
            )

            return response

        except Exception as e:
            # Record error metrics
            api_requests_total.labels(
                method=method,
                endpoint=normalized_path,
                status_code="500"
            ).inc()

            duration = time.time() - start_time
            api_request_duration.labels(
                method=method,
                endpoint=normalized_path
            ).observe(duration)

            # Log error
            logger.error(
                "API request failed",
                method=method,
                path=path,
                duration=duration,
                error=str(e),
                user_agent=request.headers.get("user-agent", ""),
                client_ip=self._get_client_ip(request),
                exc_info=True
            )

            raise

        finally:
            self.active_requests -= 1
            active_connections.set(self.active_requests)

    def _normalize_path(self, path: str) -> str:
        """
        Normalize API paths for metrics by removing IDs and other dynamic parts.
        """
        # Common patterns to normalize
        normalizations = [
            # Replace UUIDs
            (r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/{id}'),
            # Replace numeric IDs
            (r'/\d+', '/{id}'),
            # Replace email addresses
            (r'/[^/]+@[^/]+\.[^/]+', '/{email}'),
            # Replace file names with extensions
            (r'/[^/]+\.(jpg|jpeg|png|gif|pdf|txt|doc|docx|xls|xlsx|csv)', '/{file}'),
        ]

        import re
        normalized = path
        for pattern, replacement in normalizations:
            normalized = re.sub(pattern, replacement, normalized)

        return normalized

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request headers."""
        # Check for common proxy headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to client host
        return request.client.host if request.client else "unknown"


class DatabaseMetricsCollector:
    """Collect database connection metrics."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    async def collect_db_metrics(self, db_session):
        """Collect database metrics from SQLAlchemy session."""
        try:
            # Get connection pool info
            if hasattr(db_session, 'bind') and hasattr(db_session.bind, 'pool'):
                pool = db_session.bind.pool
                if hasattr(pool, 'size'):
                    from app.core.grafana_config import database_connections
                    database_connections.set(pool.checkedin() if hasattr(pool, 'checkedin') else 0)

        except Exception as e:
            self.logger.warning(f"Failed to collect database metrics: {e}")


class RedisMetricsCollector:
    """Collect Redis connection metrics."""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    async def collect_redis_metrics(self, redis_client):
        """Collect Redis metrics."""
        try:
            # Get Redis info
            if hasattr(redis_client, 'connection_pool'):
                pool = redis_client.connection_pool
                from app.core.grafana_config import redis_connections
                if hasattr(pool, '_created_connections'):
                    redis_connections.set(pool._created_connections)

        except Exception as e:
            self.logger.warning(f"Failed to collect Redis metrics: {e}")


# Metrics collectors instances
db_metrics_collector = DatabaseMetricsCollector()
redis_metrics_collector = RedisMetricsCollector()


async def collect_system_metrics():
    """Collect system-level metrics periodically."""
    logger = get_logger("system_metrics")

    try:
        import psutil

        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)

        # Memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used = memory.used
        memory_available = memory.available

        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_used = disk.used
        disk_free = disk.free

        # Log system metrics
        logger.info(
            "System metrics collected",
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            memory_used_bytes=memory_used,
            memory_available_bytes=memory_available,
            disk_percent=disk_percent,
            disk_used_bytes=disk_used,
            disk_free_bytes=disk_free
        )

        # You could also expose these as Prometheus metrics
        # For now, we're just logging them for Loki ingestion

    except ImportError:
        logger.warning("psutil not available, skipping system metrics")
    except Exception as e:
        logger.error(f"Failed to collect system metrics: {e}")


def setup_metrics_middleware(app, enable_metrics: bool = True):
    """Setup metrics middleware for the FastAPI app."""
    if enable_metrics:
        app.add_middleware(PrometheusMetricsMiddleware)
        logger.info("Prometheus metrics middleware enabled")
    else:
        logger.info("Metrics collection disabled")