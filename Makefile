# Autoflow Workspace Makefile
# Use 'make help' to see available commands

INFRA_DOCKER_FILE=./packages/backend/docker-compose.yml
TEST_DOCKER_FILE=./packages/backend/testing/docker-compose.test.yml

.PHONY: setup deps dev dev-api dev-worker dev-web dev-all start start-api start-worker start-web build db-push db-generate db-migrate install-pre-push infra-start infra-stop shell nix-shell nix-update nix-check nix-info test test-integration test-start test-stop lint format format-unsafe tsc build\:actions help

# === Setup ===
setup:
	@chmod +x ./scripts/setup/install-nix.sh
	@chmod +x ./scripts/setup/bootstrap.sh
	@./scripts/setup/bootstrap.sh

# === Dependencies ===
deps: install-pre-push
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

migrate-apply:
	bun run db:migrate

migrate:
	bun run db:generate

# === Infrastructure ===
install-pre-push:
	@chmod +x ./scripts/git/pre-push.sh
	@ln -sf ../../scripts/git/pre-push.sh ./.git/hooks/pre-push

infra-start:
	docker compose -f $(INFRA_DOCKER_FILE) up -d --wait

infra-stop:
	docker compose -f $(INFRA_DOCKER_FILE) down

# === Nix Development Environment ===
shell:
	@echo "Entering Nix development shell..."
	nix develop ./scripts/nix

nix-shell: shell

nix-update:
	cd scripts/nix && nix flake update

nix-check:
	cd scripts/nix && nix flake check

nix-info:
	cd scripts/nix && nix flake metadata

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

# === GitHub Actions ===
build\:actions:
	@echo "Building GitHub Actions..."
	@cd .github/actions && npm install -g @vercel/ncc 2>/dev/null || true
	@for dir in .github/actions/*/; do \
		if [ -f "$$dir/index.js" ]; then \
			echo "Building $$dir..."; \
			ncc build "$$dir/index.js" -o "$$dir/dist"; \
		fi \
	done

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
	@echo "  GitHub Actions:"
	@echo "    make build:actions  - Build custom GitHub Actions"
	@echo ""
	@echo "  Nix Environment:"
	@echo "    make shell          - Enter Nix development shell"
	@echo "    make nix-update     - Update Nix flake dependencies"
	@echo "    make nix-check      - Validate Nix flake configuration"
	@echo "    make nix-info       - Show Nix flake metadata"
	@echo ""
	@echo "  Setup:"
	@echo "    make setup          - Complete development environment setup (recommended)"
	@echo "    make deps           - Install dependencies only"
