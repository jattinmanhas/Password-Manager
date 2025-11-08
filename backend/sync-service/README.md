# Sync Service

Real-time synchronization service for the Password Manager application. Handles bidirectional sync between devices, conflict resolution, and change tracking.

## Features

- ✅ HTTP sync endpoint
- ✅ WebSocket real-time sync
- ✅ Conflict detection and resolution
- ✅ Change tracking
- ✅ Device management
- ✅ Optimistic locking
- ✅ Version control

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/sync-service
   go mod download
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   # Make sure JWT_SECRET matches auth-service
   ```

3. **Set up database:**
   - Make sure PostgreSQL is running
   - Run the migration: `infrastructure/database/migrations/add_sync_tables.sql`

4. **Run the service:**
   ```bash
   go run main.go
   ```

## API Endpoints

### HTTP Sync
```http
POST /api/v1/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_id": "uuid",
  "last_sync_at": "2024-01-01T00:00:00Z",
  "changes": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "device_id": "uuid",
      "type": "create",
      "item_type": "vault_item",
      "item_id": "uuid",
      "version": 1,
      "timestamp": "2024-01-01T00:00:00Z",
      "data": "encrypted-data"
    }
  ]
}
```

**Response:**
```json
{
  "changes": [...],
  "conflicts": [...],
  "last_sync_at": "2024-01-01T00:00:00Z",
  "sync_token": "token"
}
```

### WebSocket Sync
```javascript
const ws = new WebSocket('ws://localhost:3003/api/v1/sync/ws?token=<jwt-token>');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'sync',
    payload: {
      device_id: 'uuid',
      last_sync_at: '2024-01-01T00:00:00Z',
      changes: [...]
    }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'sync') {
    // Handle sync response
  }
};
```

### Register Device
```http
POST /api/v1/sync/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My iPhone",
  "type": "mobile"
}
```

### Get Devices
```http
GET /api/v1/sync/devices
Authorization: Bearer <token>
```

### Health Check
```http
GET /health
```

## How It Works

### Sync Flow

1. **Client sends sync request** with:
   - Device ID
   - Last sync timestamp
   - Pending changes

2. **Server processes:**
   - Gets changes since last sync
   - Detects conflicts (version mismatches)
   - Applies client changes (if no conflicts)
   - Returns server changes and conflicts

3. **Client applies:**
   - Server changes
   - Resolves conflicts (client decides)

### Conflict Resolution

Conflicts occur when:
- Client and server both modified the same item
- Server version > client version

The client receives conflict information and decides how to resolve:
- Use client version
- Use server version
- Merge (client-side)

### Change Tracking

All changes are logged in `change_logs` table:
- User ID
- Device ID
- Item type and ID
- Action (create, update, delete)
- Version
- Encrypted data
- Timestamp

### Device Management

Each device is registered with:
- Unique device ID
- User ID
- Device name
- Device type (web, mobile, desktop)
- Last sync timestamp

## WebSocket Protocol

### Message Types

- `sync` - Sync request/response
- `ping` - Keep-alive (automatic)
- `pong` - Keep-alive response (automatic)
- `error` - Error message

### Connection

1. Connect to `/api/v1/sync/ws?token=<jwt-token>`
2. Server sends ping every 54 seconds
3. Client must respond with pong within 60 seconds
4. Connection closes if pong not received

## Security

- JWT authentication required
- User data isolation
- Encrypted change data
- WebSocket origin validation (configure in production)

## Configuration

### Environment Variables

```bash
# Server
PORT=3003
ENVIRONMENT=development

# JWT (must match auth-service)
JWT_SECRET=change-me-to-a-secure-random-string-in-production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=pm_user
DB_PASSWORD=pm_password
DB_NAME=password_manager
DB_SSLMODE=disable

# WebSocket
WS_READ_BUFFER_SIZE=1024
WS_WRITE_BUFFER_SIZE=1024
WS_PONG_WAIT=60
WS_PING_PERIOD=54
```

## Development

### Project Structure
```
sync-service/
├── main.go                 # Application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── database/         # Database connection
│   ├── handlers/         # HTTP/WebSocket handlers
│   ├── middleware/       # Auth middleware
│   ├── repository/       # Data access layer
│   ├── service/          # Business logic
│   ├── types/            # Type definitions
│   └── utils/            # Utility functions
├── Dockerfile
├── .env.example
└── README.md
```

## Testing

```bash
# Run tests
go test ./...

# Build
go build -o sync-service main.go

# Run
./sync-service
```

## Docker

```bash
# Build
docker build -t sync-service .

# Run
docker run -p 3003:3003 --env-file .env sync-service
```

## TODO

- [ ] Add Redis pub/sub for real-time notifications
- [ ] Implement conflict resolution strategies
- [ ] Add sync status tracking
- [ ] Implement sync batching
- [ ] Add sync metrics/monitoring

