# Cloud Sync — Requirements

## Overview

AppShots currently stores all data (projects, screenshots, device layouts, and
uploaded images) in the browser's `localStorage`. This ties a user's work to a
single browser on a single machine. The goal of this feature is to let a user
sign in and have their projects follow them to any laptop, so they can continue
work anywhere.

This is delivered as:

- A **monorepo restructure** (Bun workspaces: `apps/web`, `apps/api`, `packages/shared`).
- A **backend API** (Bun + Hono) with **Postgres** for project data and
  **Cloudflare R2** for image storage.
- **Email-OTP authentication** (no password; the emailed code also verifies the
  email address).
- A **frontend sync layer** that wraps the existing `localStorage` persistence,
  keeps working offline, and performs a one-time migration of existing local
  projects on first sign-in.

### v1 Scope

- Email + one-time code (OTP) sign-in. No password. No magic link.
- Cross-device project sync for a single signed-in user.
- Image uploads stored in R2 instead of base64 in project data.
- Offline-first: the app keeps working with no connection and syncs when online.
- One-time migration of projects already in `localStorage`.

### Out of Scope (future phases)

- Google and GitHub OAuth sign-in (auth is designed to allow adding these later).
- Sharing projects with other users / collaboration.
- Real-time multi-device live editing (sync is per-save, not live cursors).

---

## Requirements

### Requirement 1 — Email OTP Authentication

**User story:** As a mobile user, I want to sign in with just my email and a
code sent to it, so that I don't have to remember a password and my email is
verified in the same step.

#### Acceptance Criteria

1. WHEN a user enters a valid email address and requests a code THEN the system
   SHALL generate a single-use numeric code, store it with an expiry, and send
   it to that email address.
2. WHEN a user submits a code that matches an unexpired, unused code for their
   email THEN the system SHALL mark the code as used, create an authenticated
   session, and treat the email as verified.
3. WHEN a user submits an incorrect, expired, or already-used code THEN the
   system SHALL reject the attempt and SHALL NOT create a session.
4. The system SHALL expire codes after a short, fixed window (e.g. 10 minutes).
5. The system SHALL limit how many codes can be requested per email in a given
   time window to prevent abuse.
6. The system SHALL NOT store or require any password at any point.
7. WHEN no email provider is configured in development THEN the system SHALL log
   the code to the server console so the flow can be tested locally.

### Requirement 2 — Persistent Sessions Across Devices

**User story:** As a user, I want to stay signed in on each device I use, so
that I don't re-authenticate on every visit but can still access my work from a
new machine by signing in there.

#### Acceptance Criteria

1. WHEN a user completes OTP verification THEN the system SHALL issue a session
   credential that persists across page reloads and browser restarts.
2. WHEN a session credential is present and valid THEN the system SHALL identify
   the user without requiring a new code.
3. WHEN a user signs out THEN the system SHALL invalidate the session on that
   device.
4. WHEN a session is expired or invalid THEN the system SHALL treat the user as
   signed out and prompt sign-in.
5. The session mechanism SHALL work independently per device, so signing in on a
   new laptop does not affect existing sessions.

### Requirement 3 — Project Cloud Storage & Sync

**User story:** As a user, I want my projects saved to the cloud, so that I can
open any laptop, sign in, and continue exactly where I left off.

#### Acceptance Criteria

1. WHEN a signed-in user creates, renames, edits, or deletes a project THEN the
   system SHALL persist that change to the backend for that user.
2. WHEN a signed-in user loads the app on any device THEN the system SHALL fetch
   their projects from the backend and load them into the editor.
3. The system SHALL scope all project data to the owning user, so a user can
   only read and write their own projects.
4. WHEN project changes occur rapidly THEN the system SHALL debounce writes to
   avoid excessive backend requests (consistent with the current 1s auto-save).
5. WHEN a project is updated THEN the system SHALL record an updated timestamp
   usable for conflict resolution.
6. WHEN the same project has been changed on two devices THEN the system SHALL
   resolve the conflict deterministically (v1: last-write-wins by updated
   timestamp) and SHALL NOT silently lose the newer version.

### Requirement 4 — Image Storage in R2

**User story:** As a user, I want my uploaded screenshots and overlay images to
sync with my projects, so that opening a project on another device shows the
images, without bloating project data.

#### Acceptance Criteria

1. WHEN a signed-in user uploads a screenshot or overlay image THEN the system
   SHALL store the image file in Cloudflare R2 and reference it by URL in the
   project data, instead of embedding base64.
2. WHEN a project is loaded on another device THEN the system SHALL display the
   images via their stored URLs.
3. The system SHALL scope uploaded images to the owning user.
4. The system SHALL validate uploaded files for type and size before storing.
5. WHEN image upload fails THEN the system SHALL surface an error and SHALL NOT
   corrupt the project data.
6. Image URLs SHALL remain accessible for display across devices (via public
   bucket URL or signed URLs).

### Requirement 5 — Offline-First Behavior

**User story:** As a user, I want the app to keep working when I'm offline or
not signed in, so that I never lose work due to connectivity.

#### Acceptance Criteria

1. WHEN a user is not signed in THEN the app SHALL continue to work fully using
   `localStorage`, exactly as it does today.
2. WHEN a signed-in user loses connectivity THEN the app SHALL continue to allow
   editing against a local cache.
3. WHEN connectivity is restored THEN the system SHALL sync pending local
   changes to the backend.
4. The system SHALL retain `localStorage` as a local cache/fallback alongside
   cloud sync.
5. WHEN a sync write fails THEN the system SHALL retry and SHALL NOT drop the
   local change.

### Requirement 6 — One-Time Migration of Local Projects

**User story:** As an existing user with projects already in my browser, I want
them uploaded to my account the first time I sign in, so that I don't lose
anything I made before signing in.

#### Acceptance Criteria

1. WHEN a user signs in for the first time AND has projects in `localStorage`
   THEN the system SHALL upload those projects to their account.
2. WHEN migrating a local project that contains base64 images THEN the system
   SHALL upload those images to R2 and rewrite the references.
3. The system SHALL perform the migration only once per account/local-state pair
   and SHALL NOT create duplicates on subsequent sign-ins.
4. WHEN migration fails partway THEN the system SHALL preserve the local data and
   SHALL be safe to retry.

### Requirement 7 — Monorepo Structure

**User story:** As the maintainer of this fork, I want the frontend and backend
to share one data model in one repo, so that project types never drift between
client and server and I can run everything with one install.

#### Acceptance Criteria

1. The repository SHALL be organized as a Bun workspace monorepo with the
   existing app under `apps/web`, the backend under `apps/api`, and shared
   TypeScript types under `packages/shared`.
2. The `Project`, `Screenshot`, `DeviceInstance`, and related types SHALL live in
   `packages/shared` and be imported by both `apps/web` and `apps/api`.
3. The existing app SHALL continue to build and run (dev + build) after the
   restructure, with no change to its current functionality.
4. A single `bun install` at the root SHALL install all workspaces.
5. Bun SHALL remain the package manager and the API runtime.

### Requirement 8 — Configuration & Secrets

**User story:** As the operator, I want all external credentials configured via
environment variables, so that secrets are never committed and environments are
easy to switch.

#### Acceptance Criteria

1. The system SHALL read Postgres connection, R2 credentials, email provider
   credentials, and session secrets from environment variables.
2. The repository SHALL provide a documented `.env.example` and SHALL NOT commit
   real secrets.
3. WHEN a required environment variable is missing THEN the API SHALL fail fast
   with a clear error at startup.
