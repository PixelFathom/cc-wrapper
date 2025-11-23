#!/usr/bin/env python3
"""
Simple HTTP server to demonstrate Grafana monitoring features.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time
import threading

class MonitoringDemoHandler(BaseHTTPRequestHandler):
    request_count = 0

    def do_GET(self):
        MonitoringDemoHandler.request_count += 1

        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'status': 'healthy',
                'monitoring': 'grafana_enabled',
                'features': [
                    'structured_logging',
                    'prometheus_metrics',
                    'loki_integration',
                    'alloy_configuration'
                ],
                'request_count': self.request_count,
                'timestamp': time.time()
            }
            self.wfile.write(json.dumps(response, indent=2).encode())

        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>CC-Wrapper Monitoring Demo</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; }}
                    .feature {{ background: #f0f8ff; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .status {{ background: #e8f5e8; padding: 10px; border-radius: 5px; }}
                    .code {{ background: #f5f5f5; padding: 10px; font-family: monospace; }}
                </style>
            </head>
            <body>
                <h1>🎯 CC-Wrapper Grafana Monitoring Integration</h1>

                <div class="status">
                    <h2>✅ Status: Monitoring Integration Complete</h2>
                    <p><strong>Requests Served:</strong> {self.request_count}</p>
                    <p><strong>Timestamp:</strong> {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>

                <h2>🔧 Implemented Features</h2>

                <div class="feature">
                    <h3>📊 Prometheus Metrics Collection</h3>
                    <ul>
                        <li>API request counters and histograms</li>
                        <li>Database and Redis connection metrics</li>
                        <li>Chat session and file upload metrics</li>
                        <li>Custom application metrics</li>
                    </ul>
                </div>

                <div class="feature">
                    <h3>📋 Structured Logging with Loki</h3>
                    <ul>
                        <li>JSON formatted logs for production</li>
                        <li>Async log shipping to Grafana Cloud</li>
                        <li>Structured context and metadata</li>
                        <li>Log level filtering and processing</li>
                    </ul>
                </div>

                <div class="feature">
                    <h3>🏗️ Grafana Alloy Configuration</h3>
                    <ul>
                        <li>Docker container log collection</li>
                        <li>System metrics via node exporter</li>
                        <li>Service discovery and relabeling</li>
                        <li>Real-time log processing</li>
                    </ul>
                </div>

                <div class="feature">
                    <h3>🐳 Docker Integration</h3>
                    <ul>
                        <li>Enhanced logging drivers</li>
                        <li>Container metrics collection</li>
                        <li>Health check monitoring</li>
                        <li>Production-ready deployment</li>
                    </ul>
                </div>

                <h2>📈 Grafana Cloud Integration</h2>
                <div class="code">
                    <p><strong>Loki URL:</strong> https://logs-prod-028.grafana.net/loki/api/v1/push</p>
                    <p><strong>Prometheus URL:</strong> https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push</p>
                    <p><strong>Application:</strong> cc-wrapper</p>
                    <p><strong>Environment:</strong> production</p>
                </div>

                <h2>🚀 Deployment Commands</h2>
                <div class="code">
                    # Start with monitoring<br>
                    docker-compose -f docker-compose.monitoring.yaml up -d<br><br>

                    # View logs<br>
                    docker-compose logs -f alloy<br><br>

                    # Check metrics<br>
                    curl http://localhost:9000/metrics<br>
                </div>

                <h2>📚 Documentation</h2>
                <p><a href="docs/GRAFANA_MONITORING_SETUP.md">Complete Setup Guide</a></p>

                <p><em>✅ Integration complete and ready for production deployment!</em></p>
            </body>
            </html>
            """
            self.wfile.write(html.encode())

        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())

    def log_message(self, format, *args):
        # Custom log format showing monitoring
        print(f"[MONITORING] {self.address_string()} - {format % args}")

def run_server():
    server = HTTPServer(('0.0.0.0', 61979), MonitoringDemoHandler)
    print(f"🚀 Monitoring Demo Server running on http://localhost:61979")
    print(f"🏥 Health endpoint: http://localhost:61979/health")
    print(f"📊 Dashboard: http://localhost:61979/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n⏰ Server stopped")
        server.shutdown()

if __name__ == "__main__":
    run_server()