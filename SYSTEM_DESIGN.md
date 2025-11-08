# Password Manager - System Design

## 1. Overview

A secure, cross-platform password manager that allows users to store, manage, and sync their passwords across multiple devices while maintaining end-to-end encryption and zero-knowledge architecture.

## 2. Requirements

### 2.1 Functional Requirements
- User registration and authentication
- Secure password storage with encryption
- Password generation
- Password strength analysis
- Auto-fill functionality
- Cross-device synchronization
- Secure sharing between users
- Password import/export
- Browser extension support
- Mobile app support
- Desktop app support
- Web vault access

### 2.2 Non-Functional Requirements
- **Security**: End-to-end encryption, zero-knowledge architecture
- **Performance**: < 200ms response time for password retrieval
- **Availability**: 99.9% uptime
- **Scalability**: Support 10M+ users
- **Compliance**: GDPR, SOC 2 compliant
- **Data Privacy**: Zero-knowledge - server cannot decrypt user data

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │  Mobile Client  │     │ Desktop Client  │
│   (React/Vue)   │     │  (React Native) │     │   (Electron)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   API Gateway          │
                    │   (Rate Limiting, Auth) │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐    ┌─────────▼─────────┐   ┌───────▼────────┐
│  Auth Service   │    │  Vault Service    │   │  Sync Service   │
│  (JWT, 2FA)     │    │  (Encryption)     │   │  (WebSocket)    │
└────────┬────────┘    └─────────┬─────────┘   └───────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Database Layer        │
                    │   (PostgreSQL + Redis)  │
                    └─────────────────────────┘
```

### 3.2 Component Architecture

#### 3.2.1 Client Applications
- **Web Application**: React/Vue.js SPA
- **Mobile Apps**: React Native (iOS/Android)
- **Desktop Apps**: Electron (Windows/macOS/Linux)
- **Browser Extensions**: Chrome, Firefox, Safari

#### 3.2.2 Backend Services

1. **API Gateway**
   - Request routing
   - Rate limiting
   - SSL termination
   - Request/response logging

2. **Authentication Service**
   - User registration/login
   - JWT token management
   - Two-factor authentication (2FA)
   - Password reset
   - Session management

3. **Vault Service**
   - Password CRUD operations
   - Encryption/decryption (client-side)
   - Password generation
   - Password strength analysis
   - Secure notes storage

4. **Sync Service**
   - Real-time synchronization via WebSocket
   - Conflict resolution
   - Change tracking
   - Device management

5. **Sharing Service**
   - Secure password sharing
   - Access control
   - Sharing permissions

6. **Notification Service**
   - Security alerts
   - Breach notifications
   - Login notifications

## 4. Data Models

### 4.1 User Model
```json
{
  "id": "uuid",
  "email": "string",
  "masterPasswordHash": "string (bcrypt)",
  "encryptionKey": "string (encrypted with master password)",
  "twoFactorEnabled": "boolean",
  "twoFactorSecret": "string (encrypted)",
  "createdAt": "timestamp",
  "lastLogin": "timestamp",
  "accountStatus": "enum: active, suspended, deleted"
}
```

### 4.2 Vault Item Model
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "enum: password, secureNote, creditCard, identity",
  "title": "string (encrypted)",
  "username": "string (encrypted)",
  "password": "string (encrypted)",
  "url": "string (encrypted)",
  "notes": "string (encrypted)",
  "folderId": "uuid",
  "favorite": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "version": "integer"
}
```

### 4.3 Folder Model
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string (encrypted)",
  "parentId": "uuid (nullable)",
  "createdAt": "timestamp"
}
```

### 4.4 Device Model
```json
{
  "id": "uuid",
  "userId": "uuid",
  "deviceName": "string",
  "deviceType": "enum: web, mobile, desktop",
  "lastSyncAt": "timestamp",
  "ipAddress": "string",
  "userAgent": "string"
}
```

### 4.5 Share Model
```json
{
  "id": "uuid",
  "vaultItemId": "uuid",
  "ownerId": "uuid",
  "sharedWithId": "uuid",
  "permission": "enum: read, write",
  "encryptedKey": "string",
  "createdAt": "timestamp",
  "expiresAt": "timestamp (nullable)"
}
```

## 5. Security Architecture

### 5.1 Encryption Flow

```
User Master Password
        │
        ▼
┌───────────────────┐
│  PBKDF2 (100k)    │  → Derives encryption key
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  AES-256-GCM      │  → Encrypts vault items
└───────────────────┘
```

### 5.2 Zero-Knowledge Architecture

1. **Client-Side Encryption**
   - All encryption/decryption happens on client
   - Master password never sent to server
   - Server only stores encrypted blobs

2. **Key Derivation**
   - Master password → PBKDF2 → Encryption Key
   - Salt stored per user (not secret)
   - 100,000+ iterations for PBKDF2

3. **Data Storage**
   - Encrypted vault items stored in database
   - Metadata encrypted separately
   - No plaintext passwords on server

### 5.3 Authentication Flow

```
1. User enters email + master password
2. Client derives key from master password
3. Client sends: email + key derivation proof (not password)
4. Server verifies proof
5. Server returns JWT token
6. Client uses token for subsequent requests
```

### 5.4 Two-Factor Authentication (2FA)

- TOTP (Time-based One-Time Password)
- SMS backup codes
- Hardware keys (WebAuthn/FIDO2)
- Biometric authentication on devices

## 6. Database Schema

### 6.1 PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    master_password_hash VARCHAR(255) NOT NULL,
    encryption_key_encrypted TEXT NOT NULL,
    salt VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret_encrypted TEXT,
    backup_codes_encrypted TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    account_status VARCHAR(20) DEFAULT 'active',
    INDEX idx_email (email),
    INDEX idx_account_status (account_status)
);

-- Vault items table
CREATE TABLE vault_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    encrypted_data TEXT NOT NULL,
    folder_id UUID,
    favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    INDEX idx_user_id (user_id),
    INDEX idx_folder_id (folder_id),
    INDEX idx_type (type)
);

-- Folders table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name_encrypted TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_id (parent_id)
);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    last_sync_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id)
);

-- Shares table
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    INDEX idx_vault_item_id (vault_item_id),
    INDEX idx_shared_with_id (shared_with_id)
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
```

### 6.2 Redis Usage

- Session storage (JWT refresh tokens)
- Rate limiting counters
- Real-time sync state
- Cache for frequently accessed data

## 7. API Design

### 7.1 Authentication Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/verify-2fa
POST   /api/v1/auth/enable-2fa
POST   /api/v1/auth/disable-2fa
```

### 7.2 Vault Endpoints

```
GET    /api/v1/vault/items
GET    /api/v1/vault/items/:id
POST   /api/v1/vault/items
PUT    /api/v1/vault/items/:id
DELETE /api/v1/vault/items/:id
POST   /api/v1/vault/items/search
POST   /api/v1/vault/generate-password
```

### 7.3 Folder Endpoints

```
GET    /api/v1/folders
POST   /api/v1/folders
PUT    /api/v1/folders/:id
DELETE /api/v1/folders/:id
```

### 7.4 Sync Endpoints

```
GET    /api/v1/sync/state
POST   /api/v1/sync/push
GET    /api/v1/sync/pull
WS     /api/v1/sync/stream
```

### 7.5 Sharing Endpoints

```
POST   /api/v1/shares
GET    /api/v1/shares
DELETE /api/v1/shares/:id
PUT    /api/v1/shares/:id
```

## 8. Technology Stack

> **💡 Cost Optimization Note**: For minimum cost, use **Go** as the backend language and deploy on **Hetzner Cloud** or **Railway.app**. See [COST_OPTIMIZATION.md](./docs/COST_OPTIMIZATION.md) for detailed cost analysis.

### 8.1 Backend

**Recommended (Cost-Optimized):**
- **Language**: **Go (Golang)** ⭐ - Low memory footprint, high performance, single binary
- **Framework**: Gin / Fiber
- **Database**: PostgreSQL (primary), Redis (cache/sessions)
- **Message Queue**: RabbitMQ (optional, can use Redis for simple queues)
- **API Gateway**: Nginx / Caddy (self-hosted) or Railway/Render (managed)
- **Container**: Docker

**Alternative:**
- **Language**: Node.js (TypeScript) - Faster development, higher resource usage
- **Framework**: Express.js / Fastify
- **Note**: ~30-50% higher infrastructure costs compared to Go

### 8.2 Frontend
- **Web**: React / Vue.js with TypeScript
- **Mobile**: React Native
- **Desktop**: Electron
- **Browser Extension**: Chrome Extension API
- **Hosting**: Vercel / Netlify (FREE tier available)

### 8.3 Infrastructure

**Cost-Optimized Options:**
- **Cloud Provider**: Hetzner Cloud (€4-20/month) / Railway.app ($5-20/month) / DigitalOcean ($5-20/month)
- **CDN**: Cloudflare (FREE tier with SSL)
- **Monitoring**: Prometheus, Grafana (self-hosted, FREE)
- **Logging**: Loki + Grafana (self-hosted, FREE) or managed service
- **CI/CD**: GitHub Actions (FREE for public repos)

**Enterprise Options (Higher Cost):**
- **Cloud Provider**: AWS / GCP / Azure
- **CDN**: CloudFront / Cloudflare Pro
- **Monitoring**: Datadog / New Relic (paid)
- **Logging**: ELK Stack (managed) / CloudWatch
- **Secrets Management**: AWS Secrets Manager / HashiCorp Vault

### 8.4 Security
- **Encryption**: AES-256-GCM, PBKDF2
- **TLS**: TLS 1.3 (FREE with Let's Encrypt / Cloudflare)
- **Secrets Management**: Environment variables (simple) / HashiCorp Vault (advanced)
- **WAF**: Cloudflare (FREE tier) / AWS WAF (paid)

## 9. Deployment Architecture

### 9.1 Production Setup

```
┌─────────────────────────────────────────────────┐
│              Load Balancer (HTTPS)              │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐
│ API Gateway  │ │ API      │ │ API      │
│   (Zone 1)   │ │ Gateway  │ │ Gateway  │
│              │ │(Zone 2)  │ │(Zone 3)  │
└───────┬──────┘ └───┬──────┘ └───┬──────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐
│   Auth      │ │  Vault   │ │   Sync   │
│  Service    │ │ Service  │ │ Service  │
└───────┬──────┘ └───┬──────┘ └───┬──────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐
│ PostgreSQL   │ │  Redis   │ │ Message  │
│  (Primary +  │ │ Cluster  │ │  Queue   │
│   Replicas)  │ │          │ │          │
└──────────────┘ └──────────┘ └──────────┘
```

### 9.2 High Availability

- Multi-region deployment
- Database replication (primary + read replicas)
- Redis cluster for high availability
- Auto-scaling based on load
- Health checks and automatic failover

## 10. Scalability Considerations

### 10.1 Horizontal Scaling
- Stateless services for easy scaling
- Database read replicas for read-heavy operations
- Caching layer (Redis) to reduce database load
- CDN for static assets

### 10.2 Performance Optimization
- Database indexing on frequently queried fields
- Connection pooling
- Query optimization
- Pagination for large result sets
- Compression for API responses

### 10.3 Caching Strategy
- Cache user sessions in Redis
- Cache frequently accessed vault metadata
- Cache password strength analysis results
- TTL-based cache invalidation

## 11. Security Best Practices

### 11.1 Application Security
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention
- CSRF protection
- Rate limiting
- Security headers (HSTS, CSP, etc.)

### 11.2 Infrastructure Security
- Network segmentation
- Firewall rules
- DDoS protection
- Regular security audits
- Penetration testing
- Vulnerability scanning

### 11.3 Compliance
- GDPR compliance (data encryption, right to deletion)
- SOC 2 Type II certification
- Regular security audits
- Data breach notification procedures

## 12. Monitoring and Observability

### 12.1 Metrics
- API response times
- Error rates
- Database query performance
- Cache hit rates
- Active user count
- Sync operation metrics

### 12.2 Logging
- Structured logging (JSON format)
- Log aggregation and analysis
- Security event logging
- Audit trail for sensitive operations

### 12.3 Alerting
- High error rates
- Performance degradation
- Security incidents
- Database connection issues
- Service downtime

## 13. Disaster Recovery

### 13.1 Backup Strategy
- Daily database backups
- Encrypted backups stored in separate region
- Point-in-time recovery capability
- Regular backup restoration tests

### 13.2 Recovery Procedures
- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 1 hour
- Automated failover procedures
- Documented recovery runbooks

## 14. Future Enhancements

- Password breach monitoring
- Dark web monitoring
- Advanced password analytics
- Family sharing plans
- Enterprise features (SSO, admin controls)
- Biometric authentication
- Hardware key support (YubiKey, etc.)
- Password health score
- Auto-change passwords feature
- Secure file storage

## 15. Development Roadmap

### Phase 1: MVP (3-4 months)
- Basic authentication
- Password storage and retrieval
- Web application
- Basic encryption

### Phase 2: Core Features (2-3 months)
- Mobile apps
- Desktop apps
- Browser extensions
- Sync functionality
- Password generation

### Phase 3: Advanced Features (3-4 months)
- Sharing functionality
- 2FA
- Advanced security features
- Performance optimization

### Phase 4: Scale & Polish (2-3 months)
- Enterprise features
- Advanced analytics
- Compliance certifications
- Performance tuning


