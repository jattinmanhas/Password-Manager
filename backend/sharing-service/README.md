# Sharing Service

Secure password sharing service for the Password Manager application. Handles sharing passwords and vault items between users with access control and permissions.

## Features

- ✅ Create shares with read/write permissions
- ✅ Share expiration support
- ✅ Share revocation
- ✅ Encrypted share key management
- ✅ Access control validation
- ✅ Get shares by owner, recipient, or vault item
- ✅ JWT authentication

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/sharing-service
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
   - The `shares` table should already exist in the schema

4. **Run the service:**
   ```bash
   go run main.go
   ```

## API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Create Share
```http
POST /api/v1/shares
Authorization: Bearer <token>
Content-Type: application/json

{
  "vault_item_id": "uuid",
  "shared_with_id": "uuid",
  "permission": "read",
  "encrypted_key": "encrypted-share-key",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Get My Shares (Shares I Created)
```http
GET /api/v1/shares
Authorization: Bearer <token>
```

### Get Shared With Me (Items Shared With Me)
```http
GET /api/v1/shares/shared-with-me
Authorization: Bearer <token>
```

### Get Share by ID
```http
GET /api/v1/shares/:id
Authorization: Bearer <token>
```

### Get Shares by Vault Item
```http
GET /api/v1/shares/vault-item/:vaultItemId
Authorization: Bearer <token>
```

### Update Share
```http
PUT /api/v1/shares/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "permission": "write",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Delete Share
```http
DELETE /api/v1/shares/:id
Authorization: Bearer <token>
```

### Revoke Share
```http
POST /api/v1/shares/:id/revoke
Authorization: Bearer <token>
```

### Health Check
```http
GET /health
```

## Share Permissions

- **read**: Recipient can view the shared item
- **write**: Recipient can view and modify the shared item

## Share Expiration

Shares can have an optional expiration date:
- If `expires_at` is `null`, the share never expires
- If `expires_at` is set, the share expires at that time
- Expired shares are automatically filtered out from queries

## Security Features

### Access Control
- Only share owners can update or delete shares
- Users can only view shares they own or that are shared with them
- Self-sharing is prevented

### Encrypted Share Keys
- Share keys are encrypted and stored in the database
- The client encrypts the vault item's encryption key with the recipient's public key
- The server never sees the plaintext share key

### Share Validation
- Validates permission values (read/write)
- Validates expiration dates (must be in future)
- Prevents duplicate shares
- Prevents self-sharing

## Configuration

### Environment Variables

```bash
# Server
PORT=3004
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
```

## Usage Examples

### Create a Share
```bash
curl -X POST http://localhost:3004/api/v1/shares \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vault_item_id": "uuid",
    "shared_with_id": "uuid",
    "permission": "read",
    "encrypted_key": "encrypted-key-from-client"
  }'
```

### Get Items Shared With Me
```bash
curl -X GET http://localhost:3004/api/v1/shares/shared-with-me \
  -H "Authorization: Bearer <token>"
```

### Update Share Permission
```bash
curl -X PUT http://localhost:3004/api/v1/shares/:id \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "permission": "write"
  }'
```

### Revoke Share
```bash
curl -X POST http://localhost:3004/api/v1/shares/:id/revoke \
  -H "Authorization: Bearer <token>"
```

## Development

### Project Structure
```
sharing-service/
├── main.go                 # Application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── database/         # Database connection
│   ├── handlers/         # HTTP handlers
│   ├── middleware/       # Auth middleware
│   ├── repository/       # Data access layer
│   ├── service/          # Business logic
│   ├── types/            # Type definitions
│   └── utils/            # Utility functions
├── Dockerfile
├── .env.example
└── README.md
```

## Security Notes

⚠️ **Important**: 
- Share keys must be encrypted client-side before sending
- The server never decrypts share keys
- Only share owners can modify or delete shares
- Expired shares are automatically filtered

## Testing

```bash
# Run tests
go test ./...

# Build
go build -o sharing-service main.go

# Run
./sharing-service
```

## Docker

```bash
# Build
docker build -t sharing-service .

# Run
docker run -p 3004:3004 --env-file .env sharing-service
```

## Related Services

- **Auth Service**: Provides JWT tokens for authentication
- **Vault Service**: Source of vault items to share
- **API Gateway**: Routes sharing requests

## TODO

- [ ] Add email notification when share is created
- [ ] Add share access logging
- [ ] Add bulk share operations
- [ ] Add share statistics
- [ ] Add share expiration reminders

