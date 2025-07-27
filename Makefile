.PHONY: help build up down logs clean dev create-admin

help:
	@echo "Available commands:"
	@echo "  make build       - Build Docker images"
	@echo "  make up          - Start production containers"
	@echo "  make down        - Stop containers"
	@echo "  make logs        - View container logs"
	@echo "  make clean       - Clean up volumes and containers"
	@echo "  make dev         - Start development environment"
	@echo "  make create-admin - Create admin user (username: admin, password: admin)"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

dev:
	docker-compose -f docker-compose.dev.yaml up

dev-down:
	docker-compose -f docker-compose.dev.yaml down

frontend-logs:
	docker-compose logs -f frontend

backend-logs:
	docker-compose logs -f backend

db-shell:
	docker-compose exec db psql -U postgres -d project_mgr

redis-cli:
	docker-compose exec cache redis-cli

create-admin:
	@echo "Creating admin user..."
	docker-compose -f docker-compose.dev.yaml exec backend python scripts/create_admin.py
	@echo ""
	@echo "Admin user setup complete!"