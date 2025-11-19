.PHONY: help build up down logs clean dev create-admin prod-build prod-up prod-down prod-logs prod-clean prod-restart prod-rebuild stats

help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Start development environment"
	@echo "  make dev-down      - Stop development environment"
	@echo "  make build         - Build Docker images (dev)"
	@echo "  make up            - Start containers (dev)"
	@echo "  make down          - Stop containers (dev)"
	@echo ""
	@echo "Production (Optimized for EC2):"
	@echo "  make prod-build    - Build optimized production images"
	@echo "  make prod-up       - Start production containers"
	@echo "  make prod-down     - Stop production containers"
	@echo "  make prod-logs     - View production logs"
	@echo "  make prod-clean    - Clean up production volumes and containers"
	@echo "  make prod-restart  - Restart production containers"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs          - View container logs"
	@echo "  make clean         - Clean up volumes and containers"
	@echo "  make create-admin  - Create admin user (username: admin, password: admin)"
	@echo "  make db-shell      - Access PostgreSQL shell"
	@echo "  make redis-cli     - Access Redis CLI"
	@echo "  make stats         - Show resource usage statistics"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down -v
	docker system prune -f

dev:
	docker compose -f docker-compose.dev.yaml up

dev-down:
	docker compose -f docker-compose.dev.yaml down

frontend-logs:
	docker compose logs -f frontend

backend-logs:
	docker compose logs -f backend

db-shell:
	docker compose exec db psql -U postgres -d project_mgr

redis-cli:
	docker compose exec cache redis-cli

create-admin:
	@echo "Creating admin user..."
	docker compose -f docker-compose.dev.yaml exec backend python scripts/create_admin.py
	@echo ""
	@echo "Admin user setup complete!"

# Production targets (optimized for EC2)
prod-build:
	@echo "Building optimized production images..."
	@echo "Enabling BuildKit for better caching and performance..."
	DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.production.yaml build --no-cache
	@echo ""
	@echo "Production images built successfully!"

prod-up:
	@echo "Starting production containers..."
	DOCKER_BUILDKIT=1 docker compose -f docker-compose.production.yaml up -d
	@echo ""
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@docker compose -f docker-compose.production.yaml ps
	@echo ""
	@echo "Production containers started! Check logs with: make prod-logs"

prod-down:
	docker compose -f docker-compose.production.yaml down

prod-logs:
	docker compose -f docker-compose.production.yaml logs -f

prod-clean:
	@echo "Cleaning up production containers and volumes..."
	docker compose -f docker-compose.production.yaml down -v
	@echo "Pruning unused Docker resources..."
	docker system prune -f
	@echo "Cleanup complete!"

prod-restart:
	@echo "Restarting production containers..."
	docker compose -f docker-compose.production.yaml restart
	@echo "Containers restarted!"

prod-rebuild:
	@echo "Rebuilding and restarting production services..."
	DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.production.yaml up -d --build
	@echo "Production services rebuilt and restarted!"

stats:
	@echo "Resource usage statistics:"
	@echo ""
	docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}"