# API Gateway

Central API gateway for the Password Manager application. Routes requests to backend services, handles rate limiting, CORS, and provides health check aggregation.

## Features

- ✅ Request routing to backend services
- ✅ Global rate limiting (Redis-based)
- ✅ CORS handling
- ✅ Health check aggregation
- ✅ Request/response logging
- ✅ SSL/TLS ready (configure at reverse proxy level)

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/api-gateway
   go mod download
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up Redis (optional, for rate limiting):**
   - Make sure Redis is running
   - Service will work without Redis but rate limiting will be disabled

4. **Run the gateway:**
   ```bash
   go run main.go
   ```

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
ENVIRONMENT=development

# Backend Services
AUTH_SERVICE_URL=http://localhost:3001
VAULT_SERVICE_URL=http://localhost:3002
SYNC_SERVICE_URL=http://localhost:3003

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# CORS
CORS_ALLOWED_ORIGINS=*
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS,PATCH
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With

# Logging
LOG_REQUESTS=true
LOG_LEVEL=info
```

## API Routes

The gateway routes requests to backend services:

- `/api/v1/auth/*` → Auth Service (port 3001)
- `/api/v1/vault/*` → Vault Service (port 3002)
- `/api/v1/sync/*` → Sync Service (port 3003)
- `/health` → Aggregated health check

### Example Requests

```bash
# Register user (routed to auth-service)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "master_password": "password123"}'

# Get vault items (routed to vault-service)
curl -X GET http://localhost:3000/api/v1/vault/items \
  -H "Authorization: Bearer <token>"

# Sync (routed to sync-service)
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "uuid", "changes": []}'

# Health check (aggregated)
curl http://localhost:3000/health
```

## Rate Limiting

The gateway implements global rate limiting using Redis:

- **Default**: 100 requests per 60 seconds per IP/user
- **Headers**: 
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp
- **Response**: 429 Too Many Requests when limit exceeded

Rate limiting is per:
- IP address (for unauthenticated requests)
- User ID (for authenticated requests)

## Health Check

The `/health` endpoint aggregates health checks from all backend services:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "auth-service": "healthy",
    "vault-service": "healthy",
    "sync-service": "healthy"
  }
}
```

Status values:
- `healthy`: All services are healthy
- `degraded`: Some services are unhealthy
- Returns 503 if degraded

## CORS

CORS is configured via environment variables:

- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins (default: `*`)
- `CORS_ALLOWED_METHODS`: Allowed HTTP methods
- `CORS_ALLOWED_HEADERS`: Allowed headers

## SSL/TLS

For production, configure SSL/TLS at the reverse proxy level (Nginx, Caddy, etc.):

```nginx
# Nginx example
server {
    listen 443 ssl;
    server_name api.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Development

### Project Structure
```
api-gateway/
├── main.go                 # Application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── health/           # Health check aggregation
│   ├── middleware/       # Rate limiting, logging
│   ├── proxy/            # Request proxying
│   └── redis/            # Redis client
├── Dockerfile
├── .env.example
└── README.md
```

### Building

```bash
# Build
go build -o api-gateway main.go

# Run
./api-gateway
```

### Testing

```bash
# Test routing
curl http://localhost:3000/api/v1/auth/health

# Test rate limiting
for i in {1..101}; do curl http://localhost:3000/health; done

# Test health aggregation
curl http://localhost:3000/health
```

## Docker

```bash
# Build
docker build -t api-gateway .

# Run
docker run -p 3000:3000 --env-file .env api-gateway
```

## Production Considerations

1. **SSL/TLS**: Configure at reverse proxy (Nginx, Caddy)
2. **Rate Limiting**: Adjust limits based on traffic
3. **Logging**: Consider structured logging (JSON)
4. **Monitoring**: Add metrics collection
5. **Load Balancing**: Use multiple gateway instances behind load balancer
6. **Redis**: Use Redis cluster for high availability

## Troubleshooting

### Rate Limiting Not Working
- Check Redis connection
- Verify `RATE_LIMIT_ENABLED=true`
- Check Redis logs

### Services Not Responding
- Verify backend services are running
- Check service URLs in configuration
- Check network connectivity

### CORS Issues
- Verify `CORS_ALLOWED_ORIGINS` includes your frontend domain
- Check browser console for CORS errors
- Ensure credentials are allowed if needed

## Related Services

- **Auth Service**: Port 3001
- **Vault Service**: Port 3002
- **Sync Service**: Port 3003

## Documentation

- [System Design](../../SYSTEM_DESIGN.md)
- [API Documentation](../../docs/API.md)

