# Grafana Cloud Monitoring Setup Guide

This guide provides step-by-step instructions for setting up Grafana Cloud monitoring for your CC-Wrapper production environment.

## 📋 Prerequisites

1. **Grafana Cloud Account**: Sign up at [grafana.com](https://grafana.com)
2. **Docker and Docker Compose**: Installed on your production server
3. **CC-Wrapper Application**: Already deployed and running

## 🚀 Quick Start

### Step 1: Configure Grafana Cloud Credentials

1. **Get your Grafana Cloud credentials** from the command you provided:
   ```bash
   GRAFANA_LOKI_URL="https://logs-prod-028.grafana.net/loki/api/v1/push"
   GRAFANA_LOKI_USER="1404926"
   GRAFANA_PROMETHEUS_URL="https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push"
   GRAFANA_PROMETHEUS_USER="2818499"
   GRAFANA_LOKI_API_KEY="your_api_key_here"
   GRAFANA_PROMETHEUS_API_KEY="your_api_key_here"
   ```

2. **Copy the monitoring environment template**:
   ```bash
   cp .env.monitoring .env
   ```

3. **Update `.env` with your actual Grafana credentials**:
   ```bash
   # Replace with your actual API key
   GRAFANA_LOKI_API_KEY=glc_your_actual_api_key_here
   GRAFANA_PROMETHEUS_API_KEY=glc_your_actual_api_key_here

   # Set environment
   ENVIRONMENT=production
   ```

### Step 2: Install Dependencies

Update your backend with the new monitoring dependencies:

```bash
cd backend
pip install -r requirements.txt
```

New dependencies added:
- `prometheus-client==0.19.0` - Prometheus metrics
- `python-json-logger==2.0.7` - JSON logging
- `structlog==24.1.0` - Structured logging

### Step 3: Deploy with Monitoring

1. **Stop existing services**:
   ```bash
   docker-compose -f docker-compose.production.yaml down
   ```

2. **Deploy with monitoring**:
   ```bash
   docker-compose -f docker-compose.monitoring.yaml up -d --build
   ```

3. **Verify services are running**:
   ```bash
   docker-compose -f docker-compose.monitoring.yaml ps
   ```

### Step 4: Verify Monitoring Setup

1. **Check Alloy health**:
   ```bash
   curl http://localhost:12345/-/healthy
   ```

2. **Check application metrics endpoint**:
   ```bash
   curl http://localhost:9000/metrics
   ```

3. **View logs**:
   ```bash
   docker-compose -f docker-compose.monitoring.yaml logs -f alloy
   docker-compose -f docker-compose.monitoring.yaml logs -f backend
   ```

## 📊 What's Monitored

### Application Metrics
- **API Performance**: Request counts, duration, status codes
- **System Resources**: CPU, memory, disk usage
- **Database**: Connection pool metrics
- **Redis**: Connection metrics
- **Chat Sessions**: Active sessions, message counts
- **File Uploads**: Upload counts, sizes

### Logs
- **Structured Application Logs**: JSON format with contextual information
- **Container Logs**: All Docker container logs
- **System Logs**: Host system logs via node exporter

### Infrastructure
- **Container Metrics**: CPU, memory, network, disk usage per container
- **Host Metrics**: System-level metrics via node exporter
- **Health Checks**: Application and service health status

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Application   │───▶│     Alloy    │───▶│ Grafana Cloud   │
│   (Backend)     │    │  (Collector) │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────┐
│ Prometheus      │    │ Docker Logs  │
│ Metrics         │    │ Collection   │
│ (/metrics)      │    │              │
└─────────────────┘    └──────────────┘
```

### Components

1. **Application**: Generates structured logs and Prometheus metrics
2. **Grafana Alloy**: Collects metrics and logs, sends to Grafana Cloud
3. **Docker**: Provides container metrics and logs
4. **Node Exporter**: System-level metrics

## ⚙️ Configuration Details

### Environment Variables

Required environment variables in `.env`:

```bash
# Monitoring Configuration
ENVIRONMENT=production
GRAFANA_LOKI_URL=https://logs-prod-028.grafana.net/loki/api/v1/push
GRAFANA_LOKI_USER=1404926
GRAFANA_LOKI_API_KEY=your_actual_api_key

GRAFANA_PROMETHEUS_URL=https://prometheus-prod-43-prod-ap-south-1.grafana.net/api/prom/push
GRAFANA_PROMETHEUS_USER=2818499
GRAFANA_PROMETHEUS_API_KEY=your_actual_api_key

# Application Labels
APP_NAME=cc-wrapper
INSTANCE_NAME=cc-wrapper-production
```

### Alloy Configuration

The Alloy agent (`monitoring/alloy-config.alloy`) handles:
- **Service Discovery**: Automatically discovers Docker containers
- **Log Processing**: Parses and structures logs
- **Metrics Collection**: Scrapes Prometheus metrics
- **Label Management**: Adds consistent labels for filtering

### Docker Logging

Enhanced logging configuration:
- **JSON File Driver**: Structured log output
- **Log Rotation**: 50MB max size, 5 files retained
- **Labels**: Container metadata included

## 📈 Grafana Dashboard Setup

### 1. Access Grafana Cloud
1. Go to your Grafana Cloud instance
2. Navigate to **Dashboards** → **Import**

### 2. Create Application Dashboard

Use these queries for key metrics:

**API Request Rate:**
```promql
rate(api_requests_total[5m])
```

**Response Times:**
```promql
histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))
```

**Active Connections:**
```promql
active_connections
```

**Error Rate:**
```promql
rate(api_requests_total{status_code=~"5.."}[5m]) / rate(api_requests_total[5m]) * 100
```

### 3. Log Queries in Loki

**Application Errors:**
```logql
{app="cc-wrapper", service="backend", level="ERROR"}
```

**Chat Activity:**
```logql
{app="cc-wrapper"} |= "chat"
```

**API Requests:**
```logql
{app="cc-wrapper"} |= "API request" | json
```

## 🚨 Alerting Setup

### Recommended Alerts

1. **High Error Rate**:
   ```promql
   rate(api_requests_total{status_code=~"5.."}[5m]) / rate(api_requests_total[5m]) > 0.05
   ```

2. **High Response Time**:
   ```promql
   histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 2
   ```

3. **Container Down**:
   ```promql
   up{job="cc-wrapper/containers"} == 0
   ```

4. **Database Connection Issues**:
   ```promql
   database_connections_active == 0
   ```

### Alert Configuration
1. Go to **Alerting** → **Alert Rules** in Grafana
2. Create new rule with appropriate queries
3. Set up notification channels (Slack, email, etc.)

## 🔧 Troubleshooting

### Common Issues

1. **Alloy not starting**:
   ```bash
   # Check Alloy logs
   docker-compose logs alloy

   # Verify configuration
   docker exec cc-wrapper-alloy alloy validate /etc/alloy/config.alloy
   ```

2. **No metrics appearing**:
   ```bash
   # Check metrics endpoint
   curl http://localhost:9000/metrics

   # Verify Alloy can reach backend
   docker exec cc-wrapper-alloy curl backend:8000/metrics
   ```

3. **Logs not appearing in Loki**:
   ```bash
   # Check API key permissions
   # Verify network connectivity
   docker exec cc-wrapper-alloy nslookup logs-prod-028.grafana.net
   ```

4. **Permission denied errors**:
   ```bash
   # Ensure Docker socket permissions
   sudo chown root:docker /var/run/docker.sock
   sudo chmod 660 /var/run/docker.sock
   ```

### Debug Commands

```bash
# Check all services status
docker-compose -f docker-compose.monitoring.yaml ps

# View real-time logs
docker-compose -f docker-compose.monitoring.yaml logs -f

# Check Alloy configuration
docker exec cc-wrapper-alloy alloy config-check

# Test metrics ingestion
curl -X POST \\
  -H "Authorization: Bearer $GRAFANA_PROMETHEUS_API_KEY" \\
  -H "Content-Type: application/x-protobuf" \\
  "$GRAFANA_PROMETHEUS_URL" \\
  --data-binary @metrics_test.txt
```

## 📚 Additional Resources

### Grafana Documentation
- [Grafana Cloud Getting Started](https://grafana.com/docs/grafana-cloud/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Prometheus Monitoring](https://grafana.com/docs/grafana-cloud/prometheus/)

### Alloy Documentation
- [Grafana Alloy](https://grafana.com/docs/alloy/)
- [Configuration Reference](https://grafana.com/docs/alloy/latest/reference/)

### Best Practices
- [Monitoring Best Practices](https://grafana.com/docs/grafana-cloud/monitoring/)
- [Log Aggregation Patterns](https://grafana.com/docs/loki/latest/best-practices/)

## 🔄 Maintenance

### Regular Tasks

1. **Log Retention**: Configure retention policies in Grafana Cloud
2. **Dashboard Updates**: Keep dashboards current with application changes
3. **Alert Tuning**: Adjust alert thresholds based on baseline metrics
4. **Cost Monitoring**: Track Grafana Cloud usage and costs

### Scaling Considerations

- **High Volume**: Consider sampling for high-traffic applications
- **Multi-Instance**: Use unique instance names for each deployment
- **Geographic Distribution**: Use appropriate Grafana Cloud regions

---

## 🎯 Next Steps

1. **Set up Grafana dashboards** with the provided queries
2. **Configure alerting** for critical metrics
3. **Implement log-based alerts** for application errors
4. **Create runbooks** for common issues
5. **Train team members** on monitoring tools

For questions or issues, refer to the troubleshooting section or check the Grafana Cloud documentation.