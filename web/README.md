# PMV2 Web Client

React + Vite frontend initialized for the current backend auth routes.

## Run

1. Install dependencies:

```bash
npm install
```

2. Configure API base URL (optional, defaults to `http://localhost:8080`):

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

4. Type-check:

```bash
npm run typecheck
```

5. Run crypto smoke-check:

```bash
npm run crypto:check
```

## Current implemented flows

- Register: `POST /api/v1/auth/register`
- Login step 1 (email/password): `POST /api/v1/auth/login`
- Login step 2 (MFA):
  - `totp_code` OR `recovery_code` (never both)
  - same endpoint: `POST /api/v1/auth/login`
- Logout: `POST /api/v1/auth/logout`
- Session bootstrap: `GET /api/v1/auth/me`
- TOTP setup: `POST /api/v1/auth/totp/setup`
- TOTP enable (returns recovery codes): `POST /api/v1/auth/totp/enable`
- TOTP verify: `POST /api/v1/auth/totp/verify`
- TOTP disable: `POST /api/v1/auth/totp/disable`

## Notes

- `device_name` is auto-suggested in UI from browser/OS and can be edited.
- Session is persisted with `HttpOnly` cookie and restored through `/auth/me`.
- Existing crypto helpers remain in `src/crypto/` for upcoming vault flows.
