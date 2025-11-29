# Autoflow Workspace Makefile
# Use 'make help' to see available commands

INFRA_DOCKER_FILE=./packages/backend/docker-compose.yml
TEST_DOCKER_FILE=./packages/backend/testing/docker-compose.test.yml

.PHONY: deps dev dev-api dev-worker dev-web dev-all start start-api start-worker start-web build db-push db-generate db-migrate test test-integration test-start test-stop lint format format-unsafe tsc help

# === Dependencies ===
deps: install-pre-push
	@ln -sf ./CONTRIBUTING.md ./AGENTS.md
	bun install

# === Development ===
dev:
	bun run dev

dev-api:
	bun run dev:api

dev-worker:
	bun run dev:worker

dev-web:
	bun run dev:web

dev-all:
	bun run dev:all

# === Production ===
start:
	bun run start

start-api:
	bun run start:api

start-worker:
	bun run start:worker

start-web:
	bun run start:web

# === Build ===
build:
	bun run build

# === Database ===
db-push:
	bun run db:push

db-generate:
	bun run db:generate

db-migrate:
	bun run db:migrate

# === Infrastructure ===
install-pre-push:
	@chmod +x ./scripts/git/pre-push.sh
	@ln -sf ../../scripts/git/pre-push.sh ./.git/hooks/pre-push

infra-start:
	docker compose -f $(INFRA_DOCKER_FILE) up -d --wait

infra-stop:
	docker compose -f $(INFRA_DOCKER_FILE) down

# === Testing ===
test: test-start
	bun test

test-integration: test-start
	bun run test:integration
	$(MAKE) test-stop

test-start:
	docker compose -f $(TEST_DOCKER_FILE) up -d --wait

test-stop:
	docker compose -f $(TEST_DOCKER_FILE) down

# === Code Quality ===
lint:
	bunx biome check .

format:
	bunx biome check --write .

format-unsafe:
	bunx biome check --write --unsafe .

tsc:
	bun run tsc

# === Help ===
help:
	@echo "Autoflow Workspace Commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev          - Start API server (default)"
	@echo "    make dev-api      - Start API server"
	@echo "    make dev-worker   - Start background worker"
	@echo "    make dev-web      - Start web server"
	@echo "    make dev-all      - Start all services"
	@echo ""
	@echo "  Production:"
	@echo "    make start        - Start API server"
	@echo "    make start-api    - Start API server"
	@echo "    make start-worker - Start background worker"
	@echo "    make start-web    - Start web server"
	@echo ""
	@echo "  Database:"
	@echo "    make db-push      - Push schema to database"
	@echo "    make db-generate  - Generate migrations"
	@echo "    make db-migrate   - Apply migrations"
	@echo ""
	@echo "  Testing:"
	@echo "    make test             - Run all tests"
	@echo "    make test-integration - Run integration tests"
	@echo "    make test-start       - Start test containers"
	@echo "    make test-stop        - Stop test containers"
	@echo ""
    @echo "  Code Quality:"
	@echo "    make lint           - Run Biome linter"
	@echo "    make format         - Format code with Biome"
	@echo "    make format-unsafe  - Format code with Biome (unsafe fixes)"
	@echo "    make tsc            - Type check"
	@echo ""
	@echo "  Setup:"
	@echo "    make deps         - Install dependencies"
