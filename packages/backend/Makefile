# Backend Package Makefile

TEST_DOCKER_FILE=./testing/docker-compose.test.yml

.PHONY: test test-integration test-start test-stop db-push db-generate db-migrate

test:
	bun test --ignore '**/integration*'

test-integration: test-start
	bun test --filter '*.integration.*'
	$(MAKE) test-stop

test-start:
	docker compose -f $(TEST_DOCKER_FILE) up -d --wait

test-stop:
	docker compose -f $(TEST_DOCKER_FILE) down

db-push:
	bun drizzle-kit push

db-generate:
	bun drizzle-kit generate

db-migrate:
	bun drizzle-kit migrate
