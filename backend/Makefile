.PHONY: help build test run clean docker-build

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build-auth: ## Build auth service
	cd auth-service && go build -o auth-service main.go

run-auth: ## Run auth service
	cd auth-service && go run main.go

test-auth: ## Test auth service
	cd auth-service && go test ./...

docker-build-auth: ## Build auth service Docker image
	cd auth-service && docker build -t password-manager-auth:latest .

clean: ## Clean build artifacts
	find . -name "*.exe" -delete
	find . -name "auth-service" -delete
	find . -name "vault-service" -delete
	find . -name "sync-service" -delete

deps: ## Download all dependencies
	cd auth-service && go mod download

fmt: ## Format code
	find . -name "*.go" -exec gofmt -w {} \;

lint: ## Lint code (requires golangci-lint)
	cd auth-service && golangci-lint run

