# Recruiter DC — Virtual Interview

A Next.js web application that delivers a **virtual interview** experience for WV Supply. Candidates speak in real time with an AI-powered video avatar (HeyGen Live Avatar) and see a live transcript of the conversation.

---

## Overview

- **Purpose:** Let candidates complete an interview by talking to an AI interviewer avatar in the browser.
- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- **Integrations:** [HeyGen Live Avatar](https://www.heygen.com/) for real-time avatar video and voice chat; session tokens and optional LiveKit data via backend API routes.

---

## Features & Functions

### Core Flow

1. **Start interview** — User clicks **Start Interview**. The app requests a session token from `/api/token`, creates a `LiveAvatarSession` (HeyGen SDK) with voice chat enabled, and starts the session.
2. **Avatar stream** — When the SDK fires `SESSION_STREAM_READY`, the app attaches the stream to a `<video>` element and attempts autoplay. If autoplay is blocked, the user can use **Force Play** from **Settings → Diagnostics**.
3. **Live transcript** — User and avatar speech are transcribed in real time via `user.transcription` and `avatar.transcription` events and shown in the right-hand **Transcript** panel, with messages labeled by sender and auto-scrolling.
4. **End session** — **Leave Interview** in the footer stops the session and returns the UI to idle.

### UI Structure

- **Header (sticky)**
  - Left: WV Supply logo (`/wvs_logo.png`).
  - Center: “Virtual Interview” title.
  - Right: **Help** and **Settings** pills (only one popover open at a time).

- **Help popover**
  - Short instructions: speak to the avatar as to a person.
  - HR contact for technical help: **(304) 399-4568** (clickable `tel:` link).

- **Settings popover**
  - **Microphone** and **Speaker** dropdowns: enumerate devices after requesting mic permission and let the user choose input/output. (Selection is stored in React state; the HeyGen SDK uses default devices unless you pass constraints elsewhere.)
  - **Diagnostics** button opens the diagnostics dialog.

- **Main content**
  - **Video stage:** Aspect-ratio box with the avatar video; when the stream is not active, a status overlay shows (e.g. “Idle”, “Initializing…”, “Waiting for avatar stream…”, “Connected”, “Failed”).
  - **Transcript panel:** Scrollable list of User/Avatar messages with distinct styling.

- **Footer**
  - **Leave Interview** — stops the session; disabled when there is no active session.

- **Diagnostics dialog** (modal)
  - **Force Play** — programmatically calls `play()` on the video element and unmutes it (for when autoplay is blocked).
  - **Diagnostic log** — scrollable log of debug messages produced by the app (e.g. “Starting…”, “Avatar stream ready”, “Attach completed”, errors).

### API Routes

| Route           | Method | Purpose |
|----------------|--------|--------|
| `/api/token`   | POST   | Requests a Live Avatar **session token** from HeyGen. Uses `LIVEAVATAR_API_KEY`, sandbox or production avatar ID, and per-requisition `liveavatar_context_id` when an interview is provided. Returns the token (and any wrapper) as returned by the Live Avatar API. |
| `/api/start`   | POST   | Gets a token and then calls Live Avatar’s **start** endpoint. Response includes `session_token`, `livekit_url`, and `livekit_client_token` for use with LiveKit or other tooling. The main UI uses `/api/token` only; `/api/start` is available for workflows that need the start response. |

- **Token request:** `POST https://api.liveavatar.com/v1/sessions/token` with `X-API-KEY`, body: `mode: 'FULL'`, `is_sandbox`, `avatar_id`, and optional `avatar_persona: { context_id }` from the interview’s requisition.
- **Start request:** `POST https://api.liveavatar.com/v1/sessions/start` with `Authorization: Bearer <session_token>`.

### Session & SDK Usage

- **Library:** `@heygen/liveavatar-web-sdk` — `LiveAvatarSession(sessionToken, { voiceChat: true })`.
- **Events used:** `SessionEvent.SESSION_STREAM_READY`, `user.transcription`, `avatar.transcription`.
- **Attachment:** When `streamReady` is true, `session.attach(videoRef.current)` is called; then the video element’s `play()` is triggered (with **Force Play** as fallback if autoplay fails).

### Design & Theming

- **Design system** is defined in `app/globals.css` with CSS variables, e.g.:
  - `--bg-color`, `--card-bg`, `--text-primary`, `--text-secondary`, `--accent-red`
  - `--radius-md`, `--radius-lg`, `--radius-pill`, `--shadow-sm`, `--shadow-md`, `--transition`
- **Layout:** Responsive; at `md` and up, video is ~70vw and transcript sits to the right; nav uses a sticky header and pill-style buttons.
- **Fonts:** Root layout loads Geist and Geist Mono via `next/font`; page body uses system UI fonts for the interview UI.

---

## Getting Started

### Prerequisites

- Node.js (version compatible with Next.js 16)
- A HeyGen Live Avatar API key (sandbox or production)

### Environment Variables

Create `.env.local` in the project root:

| Variable                   | Required | Description |
|---------------------------|----------|-------------|
| `LIVEAVATAR_API_KEY`      | Yes      | HeyGen Live Avatar API key. |
| `sql_DATABASE_URL`        | No*      | Neon PostgreSQL connection string. Required for interview codes, transcripts, admin, and reports. See `schema/README.md` to run the schema. |
| `ADMIN_SESSION_SECRET`    | No*      | Secret for signing admin session cookies (at least 16 characters). Required for `/admin` login. |

\* Required once you implement Phase 1 (interview codes, persistence). Until then, the app runs without a database.

**Database (Neon):** To use interview codes, transcripts, or admin features, create a Neon project, run `schema/001_initial.sql` once (see `schema/README.md`), and set `sql_DATABASE_URL` in `.env.local`. The app uses `lib/db.ts` for server-side queries. Set `ADMIN_SESSION_SECRET` (at least 16 chars) for admin login. Run `npm run seed` to create a seed admin user (login: seed@wvsupply.local / changeme) and test interview codes.

### Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Start Interview** to begin a session (browser will prompt for microphone access if needed).

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure (Relevant to This App)

```
app/
  layout.tsx          # Root layout, metadata, Geist fonts, globals.css
  page.tsx             # Welcome page (interview code entry)
  globals.css          # Tailwind + design tokens and component styles
  interview/
    page.tsx           # Virtual Interview UI (gated by valid code)
  api/
    token/route.ts     # POST: get Live Avatar session token
    start/route.ts     # POST: get token + start session, return LiveKit fields
    validate-code/route.ts  # POST: validate interview code, return interviewId
    dev/create-test-interview/route.ts  # POST (dev only): create test interview, return accessCode
lib/
  db.ts                # Neon serverless SQL client (server-side only)
schema/
  001_initial.sql      # Initial DB schema (users, requisitions, interviews, etc.)
  README.md            # How to run the schema on Neon
public/
  wvs_logo.png         # WV Supply logo in header
```

The welcome page is `app/page.tsx`; the interview UI is `app/interview/page.tsx` (gated by a valid interview code). API keys and server-only config stay in the API routes and environment variables.

**Test interview code:** Run `npm run seed` (with `sql_DATABASE_URL` set and schema applied) to create a test interview with code **TEST-2026**. In development you can also `POST /api/dev/create-test-interview` to get a new code.

---

## Dependencies (Summary)

- **next** — App Router, server and client components, API routes.
- **react** / **react-dom** — UI.
- **@heygen/liveavatar-web-sdk** — Live Avatar session, stream attachment, transcription events.
- **livekit-client** — Listed in package.json (e.g. for possible future LiveKit use); the current UI does not use it directly.
- **tailwindcss** — Utility-first styling; design system is extended in `globals.css`.

---

## Notes for Developers

- **Sandbox:** The app is configured for HeyGen **sandbox** (`is_sandbox: true`) and a fixed sandbox avatar ID in the token/start routes. For production, switch to a non-sandbox avatar and secure API keys and env handling.
- **Audio devices:** Microphone and speaker choices in Settings are stored in component state. The HeyGen SDK uses the browser’s default devices unless you pass `MediaStreamConstraints` or equivalent when creating or configuring the session; wiring selected device IDs into the SDK would be a separate step.
- **Transcripts:** Transcript text comes from the SDK events; there is no separate persistence. Refreshing or leaving the page clears the transcript.
- **Metadata:** Default Next.js metadata in `layout.tsx` (“Create Next App”) should be updated (e.g. title “Virtual Interview | WV Supply”, description) for production.

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [HeyGen Live Avatar](https://www.heygen.com/) — product and API docs for avatar and session configuration.
