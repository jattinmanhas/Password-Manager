# PMV2 - Self-Hosted Family Password Manager

This repository contains the initial scaffold for a low-cost, self-hosted password manager with a Go backend and web-first client roadmap.

## Repository Layout

- `SELF_HOSTED_PASSWORD_MANAGER_PLAN.md`: product and security plan.
- `backend/`: Go API service.
- `web/`: web client workspace (to be implemented next).
- `scripts/`: helper scripts for local development.

### Backend Layered Architecture

- `backend/internal/controller/`: presentation layer (HTTP handlers/controllers).
- `backend/internal/service/`: business logic layer.
- `backend/internal/repository/`: data access layer.
- `backend/internal/domain/`: core business models + interfaces.
- `backend/internal/dto/`: API request/response transfer objects.
- `backend/internal/config/`: configuration loading.
- `backend/internal/util/`: crypto + normalization utilities.
- `backend/internal/router/`: route registration + HTTP middleware.
- `backend/internal/database/`: DB connection bootstrap + schema migration.

## Week 1 Progress

- Backend:
  - PostgreSQL schema bootstrap on startup.
  - Auth endpoints with Argon2id password hashing.
  - TOTP setup/enable/verify/disable endpoints.
  - Session token issuance + hashed session token storage.
- Web:
  - Login/register/session bootstrap and TOTP setup flows wired to backend auth endpoints.
  - Client-side crypto module implemented for Argon2id KDF + XChaCha20-Poly1305 with validation hardening.

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Start API + PostgreSQL:

```bash
docker compose up --build
```

3. Health check:

```bash
curl http://localhost:8080/healthz
```
