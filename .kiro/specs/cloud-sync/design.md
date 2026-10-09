# Cloud Sync — Design

## 1. Goals & Constraints

- Let a signed-in user access their projects from any laptop.
- Keep the app fully functional offline and when signed out (localStorage stays).
- Move images out of base64 and into R2.
- No password: email OTP where the code doubles as email verification.
- Share the data model between client and server via a monorepo.
- Keep the restructure mechanical and non-breaking for the existing editor.

Non-goals for v1: OAuth, sharing/collaboration, live multi-cursor sync.

---

## 2. Monorepo Structure

Convert the current flat repo into a Bun workspace monorepo.

```
appshots/
├── package.json                 # workspace root: { "workspaces": ["apps/*", "packages/*"] }
├── bun.lock
├── .env.example
├── apps/
│   ├── web/                     # existing React app, moved here unchanged
│   │   ├── src/                 # current src/ moves here
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json         # name: "@appshots/web"
│   └── api/                     # new Bun + Hono backend
│       ├── src/
│       │   ├── index.ts         # Hono app entry, env validation, route mounting
│       │   ├── env.ts           # env parsing + fail-fast validation
│       │   ├── db/
│       │   │   ├── client.ts    # Postgres pool (Bun's bun:sql or `pg`)
│       │   │   ├── schema.sql   # tables
│       │   │   └── migrate.ts   # runs schema.sql / migrations
│       │   ├── auth/
│       │   │   ├── otp.ts       # generate/verify codes
│       │   │   ├── session.ts   # issue/verify/revoke sessions
│       │   │   ├── email.ts     # email provider (Resend) + dev console fallback
│       │   │   └── middleware.ts# requireAuth middleware
│       │   ├── routes/
│       │   │   ├── auth.ts      # POST /auth/request-code, /auth/verify, /auth/logout, GET /auth/me
│       │   │   ├── projects.ts  # CRUD + list for projects
│       │   │   └── uploads.ts   # image upload to R2
│       │   └── storage/
│       │       └── r2.ts        # S3-compatible client for R2
│       └── package.json         # name: "@appshots/api"
└── packages/
    └── shared/
        ├── src/
        │   ├── types.ts         # Project, Screenshot, DeviceInstance, ImageOverlay, ...
        │   └── index.ts
        └── package.json         # name: "@appshots/shared"
```

### Restructure steps (non-breaking)

1. Create `apps/web`, move `src/`, `index.html`, `public/`, `vite.config.ts`,
   `tsconfig*.json`, and app-specific config into it.
2. Move the current root `package.json` app fields into `apps/web/package.json`;
   create a new root `package.json` with `workspaces`.
3. Extract types from `apps/web/src/types/index.ts` into `packages/shared`;
   re-export from the old path so existing imports keep working
   (`apps/web/src/types/index.ts` → `export * from "@appshots/shared"`).
4. Verify `bun install` at root, then `bun run dev` in `apps/web` still serves
   the editor unchanged.
5. Only then scaffold `apps/api`.

TanStack Router plugin, Vite, and Tailwind configs move with the app; paths are
relative so they continue to resolve inside `apps/web`.

---

## 3. Data Model

### 3.1 Shared types (`packages/shared`)

The existing `Project`/`Screenshot`/`DeviceInstance`/`ImageOverlay` types move
here verbatim. One semantic change: image sources become **URLs** rather than
base64 after upload. The field stays `string` (`screenshotSrc`, `ImageOverlay.src`),
so no type change is required — only the value changes from a `data:` URI to an
`https:` URL. Offline/not-yet-uploaded images may still be `data:` URIs; the sync
layer resolves them on upload.

### 3.2 Postgres schema

```sql
-- users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one-time codes (OTP). Store a hash of the code, never the plaintext.
CREATE TABLE login_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_codes_email ON login_codes (email);

-- sessions. Store a hash of the session token.
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- projects. The whole Project object is stored as JSONB (matches current shape).
CREATE TABLE projects (
  id          UUID PRIMARY KEY,            -- same id the client uses
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,              -- serialized Project (minus heavy image bytes)
  updated_at  TIMESTAMPTZ NOT NULL,        -- client-provided, for last-write-wins
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_user ON projects (user_id);
```

Rationale for JSONB: the client already treats a `Project` as one self-contained
blob. Storing it as JSONB avoids shredding the nested screenshot/device/overlay
structure into dozens of tables and keeps the client/server contract trivial.
Per-user scoping is enforced in queries (every query filters by `user_id` from
the session), which is our equivalent of row-level security at the app layer.

---

## 4. Authentication (Email OTP)

### 4.1 Flow

```
Request code:
  Client → POST /auth/request-code { email }
  Server: rate-limit per email → generate 6-digit code → store hash + 10m expiry
          → send email (Resend) OR log to console in dev → 200 (no user enumeration)

Verify:
  Client → POST /auth/verify { email, code }
  Server: find newest unconsumed, unexpired code for email → compare hash
          → on match: upsert user, consume code, create session,
            set HttpOnly cookie → 200 { user }
          → on miss: 400

Session use:
  Client sends cookie automatically → requireAuth middleware verifies token hash
  GET /auth/me → { user } or 401

Logout:
  POST /auth/logout → delete session row + clear cookie
```

### 4.2 Details

- **Code:** 6 digits, cryptographically random. Stored as a hash (e.g. SHA-256);
  plaintext only exists in the email.
- **Expiry:** 10 minutes. **Rate limit:** e.g. max 5 requests / email / 15 min,
  and max N verify attempts before the code is invalidated.
- **No user enumeration:** `request-code` always returns 200 regardless of
  whether the email exists.
- **Session token:** random 32+ bytes, stored hashed; sent to the client as an
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Chosen over localStorage JWT so
  the token isn't readable by JS (XSS-safer). Default lifetime e.g. 30 days,
  sliding optional.
- **Email delivery is deferred.** v1 uses a console sender that logs the code to
  the server output — no real email provider is wired up yet. Sending is isolated
  behind a single `email.ts` interface (`sendLoginCode(email, code)`), so a real
  provider (SES, Cloudflare, etc.) can be dropped in later as a one-file change
  without touching auth logic. Provider choice is a later decision, not part of
  v1 (R1.7).
- **Extensibility:** OAuth later adds `/auth/google` + `/auth/github` callbacks
  that resolve to the same `users` row and issue the same session — no change to
  sessions or project APIs.

---

## 5. Image Storage (R2)

### 5.1 Upload flow (v1: proxied through API)

```
Client → POST /uploads (multipart: file)  [requireAuth]
  Server: validate type (png/jpg/webp/gif) + size (<= e.g. 10MB)
          → key = `${userId}/${uuid}.${ext}`
          → PutObject to R2 (S3 client)
          → return { url }
Client: store returned URL in project data (screenshotSrc / overlay.src)
```

- R2 accessed via S3-compatible API using `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and a public base URL `R2_PUBLIC_URL`
  (bucket exposed via a public r2.dev domain or custom domain).
- Images are user-scoped by key prefix (`${userId}/...`).
- v1 serves images from the public bucket URL for simplicity; a later phase can
  switch to signed URLs if privacy is needed.
- **Future optimization:** presigned PUT URLs so the browser uploads directly to
  R2, bypassing the API. Deferred to keep v1 simple.

### 5.2 Validation & errors

- Reject unsupported MIME types and oversized files with 4xx; the client keeps
  the local base64 and surfaces an error (R4.5) without corrupting project data.

---

## 6. API Surface

All responses JSON. Auth via session cookie. All project/upload routes require auth.

| Method | Path                 | Auth | Purpose |
|--------|----------------------|------|---------|
| POST   | `/auth/request-code` | no   | Send OTP to email |
| POST   | `/auth/verify`       | no   | Verify code, create session |
| POST   | `/auth/logout`       | yes  | Revoke current session |
| GET    | `/auth/me`           | yes  | Current user |
| GET    | `/projects`          | yes  | List user's projects (data + updated_at) |
| GET    | `/projects/:id`      | yes  | Fetch one project |
| PUT    | `/projects/:id`      | yes  | Upsert project (last-write-wins on updated_at) |
| DELETE | `/projects/:id`      | yes  | Delete project |
| POST   | `/uploads`           | yes  | Upload image to R2, return URL |
| GET    | `/health`            | no   | Liveness/readiness |

Upsert semantics for `PUT /projects/:id`: if the stored `updated_at` is newer
than the incoming one, the server keeps the stored version and returns it
(so the client can reconcile) rather than overwriting (R3.6).

CORS: API allows the web origin with credentials enabled (for the cookie).

---

## 7. Frontend Sync Layer

### 7.1 Where it hooks in

The existing seam is `src/lib/useLocalStorage.ts` +
`src/context/EditorContext.tsx`. We keep localStorage as the local cache and add
a sync layer alongside it rather than replacing it.

New pieces in `apps/web/src`:

```
lib/
  api.ts            # fetch wrapper (credentials: 'include', base URL from env)
  auth-client.ts    # requestCode, verify, me, logout
  sync.ts           # pull-on-login, push-on-change (debounced), retry queue
  images.ts         # uploadImage(file) -> url; resolveLocalImages(project)
context/
  AuthContext.tsx   # session state: user | null, loading, sign-in/out actions
components/
  AuthGate.tsx / SignInDialog.tsx  # email + code UI
```

### 7.2 State strategy

- `AuthContext` exposes `user`, `status`, `requestCode`, `verifyCode`, `signOut`.
- When **signed out**: `EditorContext` behaves exactly as today (localStorage only).
- When **signed in**:
  - On sign-in: `pull()` fetches `/projects`. Merge with local projects by
    `updatedAt` (last-write-wins per project id). Hydrate editor + localStorage.
  - On change: the existing debounced auto-save also enqueues a `push()` of the
    changed project to `PUT /projects/:id`. localStorage still writes first, so a
    failed network call never loses data.
  - Image uploads: when a `data:` image is added while signed in, upload to R2
    and replace the `data:` src with the returned URL before/along with the push.
- A small **outbox** (in localStorage) holds pending pushes; on reconnect or app
  load, flush the outbox with retries (R5.3, R5.5).

### 7.3 Conflict resolution (v1)

Per-project last-write-wins by `updatedAt`. On pull, if local and remote differ
for the same id, keep the newer `updatedAt`. The server also guards on `PUT`
(section 6). This is deterministic and never silently drops the newer copy.

### 7.4 Migration (one-time)

On first successful sign-in:

1. Read current `PersistedEditorState.projects` from localStorage.
2. For each project not yet on the server (by id), upload its base64 images to
   R2 and rewrite `screenshotSrc` / `overlay.src` to URLs.
3. `PUT` each migrated project.
4. Record a migration marker (e.g. `cloud-migrated:<userId>` in localStorage) so
   it runs once per account/local-state pair (R6.3). Safe to retry if it fails
   partway because upserts are idempotent by project id (R6.4).

---

## 8. Configuration

Root `.env.example` (API reads these; web reads only `VITE_API_URL`):

```env
# API
DATABASE_URL=postgres://user:pass@localhost:5432/appshots
SESSION_SECRET=change-me
SESSION_TTL_DAYS=30
# Email delivery deferred for v1: codes are logged to the server console.
# A real provider (SES / Cloudflare / etc.) + EMAIL_FROM get added in a later phase.
EMAIL_PROVIDER=console       # console (v1) | ses | ... (later)
# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=appshots
R2_PUBLIC_URL=https://<bucket>.r2.dev
# CORS / web
WEB_ORIGIN=http://localhost:5173

# Web (apps/web/.env)
VITE_API_URL=http://localhost:3000
```

`env.ts` validates required vars at startup and throws a clear error if any are
missing (R8.3). Email delivery is deferred: v1 uses the console sender, so no
email provider credentials are required to run. When a provider is added later,
its credentials become required only when `EMAIL_PROVIDER` is set to that
provider.

---

## 9. Security Notes

- Codes and session tokens are stored hashed, never plaintext.
- Session cookie is `HttpOnly` + `Secure` + `SameSite=Lax`.
- All project/image data is scoped to `user_id` from the session on every query.
- Upload type/size validation guards R2 and the client.
- No password storage anywhere.
- `request-code` avoids user enumeration.
- Rate limiting on code requests and verify attempts.

---

## 10. Testing Strategy

- **shared:** type-level only (no runtime).
- **api:** unit tests for OTP generate/verify (expiry, reuse, wrong code),
  session issue/verify/revoke, project upsert last-write-wins, upload validation.
  Integration tests against a test Postgres (or in-memory substitute) for the
  auth + projects routes.
- **web:** unit tests for `sync.ts` merge/last-write-wins and the migration
  rewrite of image refs; the existing Vitest setup is reused. Component test for
  the sign-in dialog happy path.
- Manual end-to-end: sign in on two browsers/profiles, edit in one, confirm the
  change appears in the other after reload.

---

## 11. Rollout Order (maps to tasks.md)

1. Monorepo restructure (web keeps working).
2. `packages/shared` types extracted.
3. API scaffold: Hono + env validation + Postgres connection + `/health`.
4. Auth: OTP + sessions + email (console fallback) + `/auth/*`.
5. Projects CRUD + per-user scoping.
6. R2 uploads.
7. Web: AuthContext + sign-in UI.
8. Web: sync layer (pull/push/outbox) wired into EditorContext.
9. Web: image upload integration.
10. One-time migration.
11. Tests + `.env.example` + docs.
```