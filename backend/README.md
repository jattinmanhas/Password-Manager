# Password Manager Backend

Go-based backend services for the Password Manager application.

## Services

- ✅ **api-gateway**: API routing, rate limiting, and health checks (Complete)
- ✅ **auth-service**: User authentication and authorization (Complete)
- ✅ **vault-service**: Password vault management with advanced search (Complete)
- ✅ **sync-service**: Real-time synchronization across devices (Complete)
- ✅ **sharing-service**: Secure password sharing (Complete)
- ❌ **notification-service**: Security alerts and notifications (Optional)

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Redis 7+ (optional, for caching)

### Setup

1. **Set up database:**
   ```bash
   # Create database
   createdb password_manager
   
   # Run schema
   psql -d password_manager -f ../infrastructure/database/schema.sql
   ```

2. **Run auth-service:**
   ```bash
   cd auth-service
   cp .env.example .env
   # Edit .env with your configuration
   go mod download
   go run main.go
   ```

3. **Test the service:**
   ```bash
   curl http://localhost:3001/health
   ```

## Development

### Project Structure

```
backend/
├── auth-service/        # Authentication service
│   ├── main.go
│   ├── internal/
│   │   ├── config/     # Configuration
│   │   ├── database/   # DB connection
│   │   ├── handlers/   # HTTP handlers
│   │   ├── repository/ # Data access
│   │   ├── service/    # Business logic
│   │   └── utils/       # Utilities
│   └── Dockerfile
├── api-gateway/         # API Gateway ✅
├── vault-service/       # Vault management ✅
└── sync-service/        # Sync service ✅
```

### Building

```bash
# Build auth-service
cd auth-service
go build -o auth-service main.go

# Or use Docker
docker build -t auth-service .
```

### Testing

```bash
# Run tests
cd auth-service
go test ./...
```

## Environment Variables

See each service's `.env.example` file for required environment variables.

Common variables:
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `JWT_SECRET`: JWT signing secret
- `PORT`: Service port

## API Documentation

See [../docs/API.md](../docs/API.md) for complete API documentation.


