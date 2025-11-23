#!/usr/bin/env python3
"""
Test script to verify Grafana monitoring integration works correctly.
This runs the FastAPI app with monitoring enabled for testing.
"""
import asyncio
import uvicorn
import os
import sys
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_dir))

# Set environment variables for testing
os.environ.update({
    'ENVIRONMENT': 'production',
    'POSTGRES_HOST': 'localhost',
    'POSTGRES_PORT': '5432',
    'POSTGRES_USER': 'postgres',
    'POSTGRES_PASSWORD': 'testpassword',
    'POSTGRES_DB': 'project_mgr',
    'REDIS_URL': 'redis://localhost:6379/0',
    'APP_NAME': 'cc-wrapper',
    'INSTANCE_NAME': 'cc-wrapper-test',
    # Mock Grafana credentials (won't actually send data without real API keys)
    'GRAFANA_LOKI_URL': 'https://logs-prod-028.grafana.net/loki/api/v1/push',
    'GRAFANA_LOKI_USER': '1404926',
    'GRAFANA_PROMETHEUS_URL': 'https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push',
    'GRAFANA_PROMETHEUS_USER': '2818499',
})

async def test_monitoring():
    """Test the monitoring setup."""
    print("🔧 Testing Grafana monitoring integration...")

    try:
        # Test imports
        print("📦 Testing imports...")
        from app.core.grafana_config import (
            setup_structured_logging,
            get_logger,
            api_requests_total,
            prometheus_registry
        )
        print("✅ Core Grafana configuration imports successful")

        from app.middleware.metrics import PrometheusMetricsMiddleware
        print("✅ Metrics middleware import successful")

        # Test structured logging setup
        print("📋 Testing structured logging...")
        setup_structured_logging()
        logger = get_logger("test")
        logger.info("Test log message", test_field="test_value")
        print("✅ Structured logging works")

        # Test metrics
        print("📊 Testing metrics collection...")
        api_requests_total.labels(method="GET", endpoint="/test", status_code="200").inc()
        print("✅ Metrics collection works")

        # Test Prometheus registry
        print("🎯 Testing Prometheus registry...")
        from prometheus_client import generate_latest
        metrics_output = generate_latest(prometheus_registry)
        print(f"✅ Metrics generation works ({len(metrics_output)} bytes)")

        # Create minimal FastAPI app for testing
        print("🚀 Creating test FastAPI app...")
        from fastapi import FastAPI, Response
        from app.middleware.metrics import setup_metrics_middleware

        app = FastAPI(title="Monitoring Test")

        # Add monitoring middleware
        setup_metrics_middleware(app)

        @app.get("/")
        async def root():
            logger.info("Test endpoint accessed")
            return {"message": "Monitoring test successful", "status": "healthy"}

        @app.get("/health")
        async def health():
            return {"status": "healthy"}

        @app.get("/metrics")
        async def metrics():
            return Response(
                generate_latest(prometheus_registry),
                media_type="text/plain"
            )

        print("✅ FastAPI app with monitoring created successfully")

        # Start the server
        print(f"🌐 Starting test server on port 61979...")
        print(f"📍 URL: http://localhost:61979")
        print(f"📊 Metrics: http://localhost:61979/metrics")
        print(f"🏥 Health: http://localhost:61979/health")
        print("\n🎉 Monitoring integration test PASSED!")
        print("⏰ Starting server for 60 seconds for testing...")

        config = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=61979,
            log_level="info"
        )
        server = uvicorn.Server(config)

        # Run server for limited time for testing
        task = asyncio.create_task(server.serve())

        # Wait for 60 seconds then stop
        try:
            await asyncio.wait_for(task, timeout=60.0)
        except asyncio.TimeoutError:
            print("\n⏰ Test timeout reached, stopping server...")
            server.should_exit = True
            await task

    except Exception as e:
        print(f"❌ Monitoring integration test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    print("🔍 Grafana Monitoring Integration Test")
    print("=" * 50)

    # Run the test
    success = asyncio.run(test_monitoring())

    if success:
        print("\n✅ All monitoring tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Monitoring tests failed!")
        sys.exit(1)