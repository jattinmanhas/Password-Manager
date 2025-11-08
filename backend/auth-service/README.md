# Auth Service

Authentication service for the Password Manager application.

## Features

- ✅ User registration
- ✅ User login with JWT tokens
- ✅ **Bcrypt password hashing** (cost factor 12, configurable)
- ✅ JWT token generation and validation
- ✅ Refresh token endpoint with token rotation
- ✅ Logout with token blacklisting
- ✅ Rate limiting (Redis-based)
- ✅ Two-Factor Authentication (2FA) - TOTP with backup codes
- ✅ Password reset functionality
- ✅ Change password endpoint
- ✅ Secure key derivation using PBKDF2

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/auth-service
   go mod download
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   - Make sure PostgreSQL is running
   - Run the schema from `../../infrastructure/database/schema.sql`

4. **Set up Redis (optional but recommended):**
   - Required for rate limiting and token blacklisting
   - Service will work without Redis but with limited features

5. **Run the service:**
   ```bash
   go run main.go
   ```

## API Endpoints

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "master_password": "secure-password-123",
  "encryption_key_proof": "derived-key-proof"
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "master_password_proof": "master-password"
}
```

### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt-refresh-token"
}
```

### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

### Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token",
  "new_password": "new-secure-password"
}
```

### Enable 2FA
```http
POST /api/v1/auth/enable-2fa
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "password": "user-password"
}
```

### Verify 2FA
```http
POST /api/v1/auth/verify-2fa
Content-Type: application/json

{
  "code": "123456"
}
```

### Disable 2FA
```http
POST /api/v1/auth/disable-2fa
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "password": "user-password",
  "code": "123456"
}
```

### Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

### Health Check
```http
GET /health
```

## Security Features

### Password Hashing
- **Bcrypt** with configurable cost factor (default: 12)
- **Backward compatibility** with SHA-256 (legacy support)
- **Automatic migration** - legacy hashes upgraded to bcrypt on login

### Rate Limiting
- Redis-based rate limiting
- Configurable requests per window (default: 5 per 60 seconds)
- Per-IP or per-user tracking
- Rate limit headers in responses

### Token Management
- JWT access tokens (24 hours default)
- JWT refresh tokens (7 days default)
- Token blacklisting for logout
- Token rotation on refresh

### Two-Factor Authentication
- TOTP (Time-based One-Time Password)
- QR code generation
- 10 backup codes
- Encrypted secret storage

## Configuration

### Environment Variables

```bash
# Server
PORT=3001
ENVIRONMENT=development

# JWT
JWT_SECRET=change-me-to-a-secure-random-string-in-production
JWT_EXPIRY_HOURS=24

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=pm_user
DB_PASSWORD=pm_password
DB_NAME=password_manager
DB_SSLMODE=disable

# Encryption
PBKDF2_ITERATIONS=100000
BCRYPT_COST=12

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_REQUESTS=5
RATE_LIMIT_WINDOW=60

# Password Reset
RESET_TOKEN_EXPIRY_MINUTES=30
```

### Bcrypt Cost Factor

The `BCRYPT_COST` determines the computational cost of hashing:
- **4-6**: Fast (testing only)
- **10-12**: Recommended for most applications (default: 12)
- **13-14**: Higher security, slower
- **15+**: Very slow, not recommended

## Development

### Project Structure
```
auth-service/
├── main.go                 # Application entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── database/         # Database connection
│   ├── encryption/       # Encryption utilities
│   ├── handlers/         # HTTP handlers
│   ├── middleware/       # Auth & rate limiting middleware
│   ├── redis/            # Redis client
│   ├── repository/       # Data access layer
│   ├── service/          # Business logic
│   ├── types/            # Type definitions
│   └── utils/            # Utility functions
├── Dockerfile
├── .env.example
└── README.md
```

## Security Notes

✅ **Production Ready**: This service is production-ready with:
- Bcrypt password hashing
- Rate limiting
- Token blacklisting
- 2FA support
- Secure password reset

⚠️ **Before Production**:
1. Generate strong JWT secret: `openssl rand -hex 32`
2. Enable HTTPS/TLS
3. Set up email sending for password reset (currently logs to console)
4. Configure appropriate bcrypt cost (12-14 recommended)

## Backward Compatibility

The service maintains backward compatibility with SHA-256 password hashes:
- Legacy SHA-256 hashes are automatically detected
- Users with legacy hashes can still log in
- Hashes are automatically upgraded to bcrypt on successful login
- No user action required

## Testing

```bash
# Run tests
go test ./...

# Build
go build -o auth-service main.go

# Run
./auth-service
```

## Docker

```bash
# Build
docker build -t auth-service .

# Run
docker run -p 3001:3001 --env-file .env auth-service
```

## TODO

- [ ] Add email sending for password reset
- [ ] Implement email verification
- [ ] Add session management
- [ ] Add audit logging
- [ ] Add password strength requirements
