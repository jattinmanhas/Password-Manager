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

## Current implemented flows

- Register: `POST /v1/auth/register`
- Login step 1 (email/password): `POST /v1/auth/login`
- Login step 2 (MFA):
  - `totp_code` OR `recovery_code` (never both)
  - same endpoint: `POST /v1/auth/login`
- Logout: `POST /v1/auth/logout`
- TOTP setup: `POST /v1/auth/totp/setup`
- TOTP enable (returns recovery codes): `POST /v1/auth/totp/enable`
- TOTP verify: `POST /v1/auth/totp/verify`

## Notes

- `device_name` is auto-suggested in UI from browser/OS and can be edited.
- Session token is stored in `localStorage` for this starter app.
- Existing crypto helpers remain in `src/crypto/` for upcoming vault flows.
