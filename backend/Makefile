.PHONY: run clean build migrate-up migrate-down migrate-drop help

# Colors
CYAN := \033[36m
RESET := \033[0m

# Build output
BIN_API := bin/api
BIN_MIGRATE := bin/migrate

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(CYAN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

run: ## Start the API server
	go run cmd/api/main.go

build: ## Build API and Migrate binaries
	@echo "Building API..."
	go build -o $(BIN_API) ./cmd/api
	@echo "Building Migrator..."
	go build -o $(BIN_MIGRATE) ./cmd/migrate
	@echo "Build complete."

migrate-up: ## Run manual migrations up
	go run cmd/migrate/main.go up

migrate-down: ## Run manual migrations down
	go run cmd/migrate/main.go down

migrate-drop: ## Drop all tables (force recovery)
	go run cmd/migrate/main.go drop

clean: ## Clean build output
	rm -rf bin/
