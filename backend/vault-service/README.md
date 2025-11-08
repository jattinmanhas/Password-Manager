# Vault Service

Vault management service for the Password Manager application. Handles CRUD operations for passwords, secure notes, and folders.

## Features

- ✅ Vault item CRUD operations (passwords, secure notes, credit cards, identities)
- ✅ Folder management (create, update, delete, hierarchy)
- ✅ Password generation with customizable options
- ✅ Password strength analysis
- ✅ Search functionality
- ✅ Optimistic locking (version control)
- ✅ Favorite items
- ✅ JWT authentication

## Setup

1. **Install dependencies:**
   ```bash
   cd backend/vault-service
   go mod download
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   # Make sure JWT_SECRET matches auth-service
   ```

3. **Run the service:**
   ```bash
   go run main.go
   ```

## API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Vault Items

#### Get All Items
```http
GET /api/v1/vault/items?folderId=uuid&type=password
```

#### Get Item
```http
GET /api/v1/vault/items/:id
```

#### Create Item
```http
POST /api/v1/vault/items
Content-Type: application/json

{
  "type": "password",
  "encrypted_data": "encrypted-blob",
  "folder_id": "uuid",
  "favorite": false
}
```

#### Update Item
```http
PUT /api/v1/vault/items/:id
Content-Type: application/json

{
  "encrypted_data": "updated-encrypted-blob",
  "version": 1
}
```

#### Delete Item
```http
DELETE /api/v1/vault/items/:id
```

#### Search Items
```http
POST /api/v1/vault/items/search
Content-Type: application/json

{
  "query": "search-term",
  "type": "password",
  "folder_id": "uuid",
  "favorite": true
}
```

### Password Generation

#### Generate Password
```http
POST /api/v1/vault/generate-password
Content-Type: application/json

{
  "length": 20,
  "include_uppercase": true,
  "include_lowercase": true,
  "include_numbers": true,
  "include_symbols": true
}
```

### Folders

#### Get Folders
```http
GET /api/v1/vault/folders?parentId=uuid
```

#### Create Folder
```http
POST /api/v1/vault/folders
Content-Type: application/json

{
  "name_encrypted": "encrypted-folder-name",
  "parent_id": "uuid"
}
```

#### Update Folder
```http
PUT /api/v1/vault/folders/:id
Content-Type: application/json

{
  "name_encrypted": "updated-encrypted-name"
}
```

#### Delete Folder
```http
DELETE /api/v1/vault/folders/:id
```

## Item Types

- `password` - Password entry
- `secureNote` - Secure note
- `creditCard` - Credit card information
- `identity` - Identity information

## Security Notes

⚠️ **Important**: 
- All data is encrypted **client-side** before being sent to the server
- The server only stores encrypted blobs
- Never send plaintext passwords to the server
- Use HTTPS in production

## Version Control

Items use optimistic locking with version numbers:
- Each item has a `version` field
- When updating, include the current `version` in the request
- If version doesn't match, update fails with 409 Conflict
- This prevents concurrent modification conflicts

## Development

### Project Structure
```
vault-service/
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
└── Dockerfile
```

## TODO

- [ ] Implement searchable encryption for better search
- [ ] Add item import/export functionality
- [ ] Add item sharing endpoints
- [ ] Implement item history/versioning
- [ ] Add bulk operations
- [ ] Add item tags/categories
- [ ] Implement item expiration

