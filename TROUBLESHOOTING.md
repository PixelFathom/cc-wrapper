# Troubleshooting Guide

## Frontend Not Deploying

If the frontend container fails to start, try these steps:

### 1. Check Docker logs
```bash
docker-compose logs frontend
# or
make frontend-logs
```

### 2. Build issues

If you see build errors:
```bash
# Clean everything and rebuild
make clean
make build
make up
```

### 3. Use development mode first
```bash
# This uses simpler Dockerfile and hot reloading
make dev
```

### 4. Manual build test
```bash
cd frontend
npm install
npm run build
npm start
```

### 5. Common issues and solutions

**Issue**: "Module not found" errors
**Solution**: 
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Issue**: "Cannot find server.js"
**Solution**: Ensure Next.js standalone build is working:
```bash
cd frontend
npm run build
# Check if .next/standalone/server.js exists
ls -la .next/standalone/
```

**Issue**: API connection errors
**Solution**: Check environment variables:
```bash
# In docker-compose.yaml, ensure:
environment:
  - NEXT_PUBLIC_BACKEND_HOST=http://backend:8000
```

### 6. Alternative deployment

If standalone mode fails, use the simple Dockerfile:
```bash
# In docker-compose.yaml, change frontend build to:
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile.simple
```

## Backend Issues

### Database connection
```bash
# Check if database is running
docker-compose ps db
# Check database logs
docker-compose logs db
```

### Redis connection
```bash
# Check Redis
docker-compose exec cache redis-cli ping
```

## Network Issues

If containers can't communicate:
```bash
# Restart with network cleanup
docker-compose down
docker network prune -f
docker-compose up
```