# Docker Compose Setup

Docker Compose configuration for running all Password Manager services locally.

## Services

- **postgres**: PostgreSQL 15 database
- **redis**: Redis 7 cache
- **api-gateway**: API Gateway (Port 3000)
- **auth-service**: Authentication service (Port 3001)
- **vault-service**: Vault management service (Port 3002)
- **sync-service**: Sync service (Port 3003)
- **sharing-service**: Sharing service (Port 3004)

## Quick Start

1. **Start all services:**
   ```bash
   cd infrastructure/docker
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop all services:**
   ```bash
   docker-compose down
   ```

4. **Stop and remove volumes:**
   ```bash
   docker-compose down -v
   ```

## Environment Variables

The services use environment variables defined in `docker-compose.yml`. For local development, you can override them by:

1. Creating a `.env` file in the `infrastructure/docker` directory
2. Or modifying the environment variables directly in `docker-compose.yml`

### Important: Change JWT Secret

**Before running in production**, change the `JWT_SECRET` in all services:

```bash
# Generate a secure secret
openssl rand -hex 32
```

Update in `docker-compose.yml`:
- `auth-service` → `JWT_SECRET`
- `vault-service` → `JWT_SECRET`
- `sync-service` → `JWT_SECRET`
- `sharing-service` → `JWT_SECRET`

## Service URLs

When running with docker-compose, services communicate via service names:

- API Gateway: `http://localhost:3000`
- Auth Service: `http://localhost:3001` (internal: `http://auth-service:3001`)
- Vault Service: `http://localhost:3002` (internal: `http://vault-service:3002`)
- Sync Service: `http://localhost:3003` (internal: `http://sync-service:3003`)
- Sharing Service: `http://localhost:3004` (internal: `http://sharing-service:3004`)

## Database Setup

The database schema is automatically loaded from `../database/schema.sql` when the postgres container starts for the first time.

## Health Checks

All services include health checks. Check service status:

```bash
# Check all services
docker-compose ps

# Check specific service
docker-compose ps api-gateway
```

## Volumes

- `postgres_data`: PostgreSQL data persistence
- `redis_data`: Redis data persistence

## Networks

All services are connected to the `password-manager-network` bridge network.

## Development

### Rebuild Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build auth-service
```

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway
```

### Execute Commands in Containers

```bash
# Access postgres
docker-compose exec postgres psql -U pm_user -d password_manager

# Access redis
docker-compose exec redis redis-cli
```

## Production Considerations

1. **Change all JWT secrets** to secure random values
2. **Use environment files** (`.env`) instead of hardcoding values
3. **Enable SSL/TLS** at reverse proxy level
4. **Use secrets management** (Docker secrets, Kubernetes secrets, etc.)
5. **Configure resource limits** for containers
6. **Set up monitoring** and logging
7. **Use production database** (not containerized for production)

## Troubleshooting

### Services won't start
- Check if ports are already in use
- Verify database is healthy: `docker-compose ps postgres`
- Check logs: `docker-compose logs <service-name>`

### Database connection errors
- Ensure postgres is healthy: `docker-compose ps postgres`
- Check database logs: `docker-compose logs postgres`
- Verify environment variables match database credentials

### Redis connection errors
- Ensure redis is healthy: `docker-compose ps redis`
- Check redis logs: `docker-compose logs redis`

## Related Documentation

- [Backend README](../../backend/README.md)
- [System Design](../../SYSTEM_DESIGN.md)

