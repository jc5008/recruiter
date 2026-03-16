# Recruiter DC — Virtual Interview

A Next.js web application for **WV Supply** that delivers an AI-powered virtual interview experience. Candidates enter a unique interview code, complete a short orientation and audio check, then speak in real time with a video avatar (HeyGen Live Avatar). The conversation is transcribed, persisted, and after the interview an AI screening report is generated and emailed as a PDF.

---

## Product Overview

**Purpose:** Enable candidates to complete a job screening interview by talking to an AI interviewer avatar in the browser. HR staff register candidates and receive unique access codes; admins can watch live sessions (with TTS playback) and receive post-interview AI evaluation reports by email.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Neon PostgreSQL, HeyGen Live Avatar SDK.

**Integrations:** HeyGen Live Avatar (real-time avatar video and voice), Resend (email and PDF delivery), OpenAI (screening evaluation), Pushover (optional candidate-entry notifications), Puppeteer/Chromium (PDF generation on Vercel).

---

## Features (Summary)

| Area | Feature | Description |
|------|---------|-------------|
| **Candidate** | Interview code entry | Welcome page: candidate enters code; validated against DB (deadline, 31‑min reuse window). |
| **Candidate** | Orientation & audio check | Step 1: watch welcome video (required checkbox). Step 2: speaker + mic test. Step 3: enter code → connect. |
| **Candidate** | Virtual interview | Live avatar (HeyGen), real-time transcript, in-call **Audio Controls** pill (mute, mic/speaker selection), 15‑min countdown and time-remaining notifications, “Your turn” prompt, Leave Interview → thank-you page. |
| **Candidate** | Thank-you page | Shown after leaving; link back to home. |
| **Admin** | Login & auth | Session-based admin login; roles: SUPER_ADMIN, ADMIN, OBSERVER, AUDITOR. Forgot/reset password via email (Resend). |
| **Admin** | Register candidate | Form: name, email, job/requisition, deadline, resume text. Generates unique access code; confirmation screen with copy-to-clipboard; optional email to HR. |
| **Admin** | Requisitions | Create and manage job requisitions (number, title, requirements, qualifications, skills). Job Analysis Instructions and LiveAvatar context per requisition. Deactivate requisitions. |
| **Admin** | Live sessions | List active interviews; open **Live Observation** for a session. |
| **Admin** | Live observation (TTS) | Real-time transcript; OpenAI TTS playback (Interviewer: Shimmer, Candidate: Marin). Play/pause, resume real-time, click a line to play from that line. Consecutive same-speaker segments merged for TTS within 5s. |
| **Admin** | Developer tools | Super Admin: select interview, **Compile aggregated report**, **Trigger evaluation** (OpenAI), **Deliver report (email)**. **Pushover test** button to verify notifications. |
| **Admin** | Settings | System instruction preface (AI evaluation); report delivery email (Resend recipient). |
| **Admin** | Users | List users; add/edit/deactivate (Super Admin). |
| **Backend** | Code validation | `POST /api/validate-code`: check code, deadline, 31‑min reuse from `started_at` (reuse allowed regardless of status). Pushover notification on code entry (optional). |
| **Backend** | Transcript persistence | User/avatar segments sent to `POST /api/interviews/[id]/transcript` (debounced); stored in `transcript_segments`. |
| **Backend** | Completion & report | On Leave or page unload: `POST /api/interviews/[id]/complete` → mark COMPLETED, aggregate data, run OpenAI evaluation, generate PDF, send via Resend. Completion can reprocess if code was reused within 31 min. |

---

## Candidate Flow (Detail)

1. **Welcome (`/`)**  
   - Step 1: Watch the welcome video; required checkbox to continue.  
   - Step 2: Audio check (play test sound, test microphone).  
   - Step 3: Enter interview code → validate → store `interview_id` and candidate name in sessionStorage → redirect to `/interview`.

2. **Interview (`/interview`)**  
   - Gated by valid `interview_id` in sessionStorage; otherwise redirect to `/`.  
   - Header: logo, **“[FirstName LastName]'s Virtual Interview”**, Help and Settings.  
   - **Start Interview** → request token from `/api/token`, create HeyGen `LiveAvatarSession` with voice chat, start session.  
   - When `SESSION_STREAM_READY`, attach stream to `<video>`, autoplay; overlay dismisses (tap to dismiss if autoplay blocked).  
   - **Audio Controls** pill (bottom-left when session active): mute/unmute, “More” → microphone and speaker selection, Test audio devices. Mic/speaker changes apply in-call (HeyGen `voiceChat.setDevice`, `setSinkId` on video).  
   - Live transcript (User / Avatar) in side panel; segments persisted via `/api/interviews/[id]/transcript`.  
   - 15‑minute progress bar; 5 / 2 / 1 minute remaining notifications.  
   - **Leave Interview** → stop session, call `/api/interviews/[id]/complete`, redirect to `/thank-you`.  
   - If user closes tab without leaving, `pagehide` triggers completion so the report still runs.

3. **Thank you (`/thank-you`)**  
   - Confirmation and link back home.

---

## Admin Portal (`/admin`)

- **Login** (`/admin/login`), **Forgot password**, **Reset password** (email links).  
- **Dashboard:** links to Register candidate, Requisitions, Live sessions, Developer tools, Settings, Users.  
- **Register candidate:** form → creates interview row, generates access code; confirmation with copy code.  
- **Requisitions:** list, create, edit (incl. Job Analysis Instructions, LiveAvatar context), deactivate.  
- **Live sessions:** list active interviews → open **Live Observation** for one.  
- **Live Observation** (`/admin/live/[id]`): real-time transcript; TTS playback (OpenAI: gpt-4o-mini-tts, Shimmer/Marin, 1.25×). Play/pause, Resume real-time, click line to play from that line; device list in popover.  
- **Developer tools** (`/admin/developer`): Super Admin only. Select interview → Compile report, Run evaluation, Deliver report (email), Send test Pushover notification.  
- **Settings:** Instruction preface (text for AI evaluation), Report delivery email.  
- **Users:** list, add, edit, deactivate (Super Admin).

---

## Post-Interview Pipeline

When a candidate leaves (or tab closes after session start):

1. **Complete** (`POST /api/interviews/[id]/complete`): set interview status to COMPLETED, `ended_at`, `duration_seconds`.  
2. **Aggregate:** candidate, requisition, system instructions, job analysis instructions, transcript, resume → single prompt (see `lib/aggregate-interview-data.ts`, `buildAggregatedPrompt`).  
3. **Store:** `interview_reports.aggregated_prompt_text` and row for the interview.  
4. **Evaluate:** OpenAI (default `gpt-5-mini`, configurable) → structured screening report; store in `interview_reports.ai_evaluation_json`.  
5. **Report:** PDF generated (Puppeteer/Chromium): AI Evaluation → Resume → Transcript.  
6. **Deliver:** Email PDF via Resend to the address in Admin → Settings (report delivery email).

If the same code is used again within **31 minutes** of `started_at`, the code is accepted and a later completion **reprocesses** (aggregate + evaluate + report) with the new transcript/data.

---

## API Routes (Reference)

| Route | Method | Purpose |
|-------|--------|---------|
| **Candidate & session** | | |
| `/api/validate-code` | POST | Validate interview code; return interviewId, candidate name. Optional Pushover on entry. |
| `/api/token` | POST | HeyGen Live Avatar session token (optional `interviewId` for persona/context). |
| `/api/start` | POST | Token + start session (LiveKit fields); UI uses token only. |
| `/api/interviews/[id]/start` | POST | Mark interview started (`started_at`, status ACTIVE). |
| `/api/interviews/[id]/transcript` | POST | Append transcript segments (debounced from client). |
| `/api/interviews/[id]/complete` | POST | Mark COMPLETED, aggregate, evaluate, PDF, email. |
| `/api/interviews/[id]/evaluate` | POST | Run OpenAI evaluation only. |
| `/api/interviews/[id]/deliver` | POST | Send report email (PDF) via Resend. |
| **Admin auth** | | |
| `/api/auth/login` | POST | Admin login. |
| `/api/auth/logout` | POST | Logout. |
| `/api/auth/session` | GET | Current session / role. |
| `/api/auth/forgot-password` | POST | Request reset email. |
| `/api/auth/reset-password/validate` | POST | Validate reset token. |
| `/api/auth/reset-password` | POST | Set new password. |
| **Admin data** | | |
| `/api/admin/candidates` | POST | Register candidate (create interview + code). |
| `/api/admin/requisitions` | GET, POST | List/create requisitions. |
| `/api/admin/requisitions/[id]` | GET, PUT | Get/update requisition. |
| `/api/admin/requisitions/list` | GET | List requisitions (e.g. dropdowns). |
| `/api/admin/requisitions/[id]/deactivate` | POST | Deactivate requisition. |
| `/api/admin/live/sessions` | GET | List active interviews for live view. |
| `/api/admin/live/observe/[id]/meta` | GET | Interview metadata for observation. |
| `/api/admin/live/observe/[id]/transcript` | GET | Poll transcript segments (after/after_id). |
| `/api/admin/live/tts` | POST | OpenAI TTS (text, speaker → audio). |
| `/api/admin/developer/interviews` | GET | List interviews (Super Admin). |
| `/api/admin/developer/compile-report` | POST | Build aggregated report for an interview. |
| `/api/admin/developer/evaluate` | POST | Run AI evaluation for an interview. |
| `/api/admin/developer/deliver` | POST | Send report email for an interview. |
| `/api/admin/developer/pushover-test` | POST | Send test Pushover notification. |
| `/api/admin/settings/instruction-preface` | GET, PUT | System instruction for AI. |
| `/api/admin/settings/report-delivery-email` | GET, PUT | Report recipient email. |
| `/api/admin/users` | GET, POST | List/create users. |
| `/api/admin/users/[id]` | GET, PUT | Get/update user. |
| `/api/admin/users/[id]/deactivate` | POST | Deactivate user. |
| **Dev** | | |
| `/api/dev/create-test-interview` | POST | Create test interview; return access code. |

---

## Environment Variables

Create `.env.local` in the project root. See `.env.example` for a template.

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEAVATAR_API_KEY` | Yes | HeyGen Live Avatar API key. |
| `LIVEAVATAR_SANDBOX_MODE` | No | `YES` = sandbox avatar (no credits, ~1 min); `NO` = production. |
| `NEXT_PUBLIC_AVATAR_ID` | Yes (prod) | HeyGen avatar ID (sandbox or production). |
| `sql_DATABASE_URL` | Yes* | Neon PostgreSQL connection string. Required for codes, admin, transcripts, reports. |
| `ADMIN_SESSION_SECRET` | Yes* | Cookie signing secret (min 16 chars) for admin sessions. |
| `RESEND_API_KEY` | Yes** | Resend API key (forgot-password, report delivery). |
| `RESEND_FROM_EMAIL` | Yes** | From address (must be verified in Resend). |
| `NEXT_PUBLIC_APP_URL` | No | Base URL for reset links (e.g. production URL). |
| `OPENAI_API_KEY` | Yes*** | OpenAI API key for screening evaluation. |
| `OPENAI_SCREENING_MODEL` | No | Model name (default: gpt-5-mini). |
| `CHROMIUM_REMOTE_EXEC_PATH` | Yes**** | Vercel: URL to Chromium pack for PDF (see `.env.example`). |
| `PUSHOVER_API_TOKEN` | No | Pushover app token (optional code-entry notifications). |
| `PUSHOVER_GROUP_KEY` | No | Pushover group key (optional). |

\* Required for interview codes and admin.  
\** Required for forgot-password and report email delivery.  
\*** Required for AI evaluation and report content.  
\**** Required for PDF generation on Vercel; not needed for local dev.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20.9.0  
- A HeyGen Live Avatar API key and avatar ID  
- (Recommended) Neon PostgreSQL and Resend for full flow

### Database

1. Create a Neon project and run the schema once. See **`schema/README.md`**.  
2. Run migrations in order: `001_initial.sql`, then `002_password_reset.sql`, `003_requisition_context.sql`, `004_aggregated_prompt.sql`, `005_job_analysis_instructions.sql` as applicable.  
3. Set `sql_DATABASE_URL` in `.env.local`.  
4. Run `npm run seed` to create a seed admin user and test interviews (admin: seed@wvsupply.local / changeme; test code e.g. TEST-2026).

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use a test interview code (from seed or `/api/dev/create-test-interview`) on the welcome page to reach the interview.

### Build for production

```bash
npm run build
npm start
```

For PDF report generation on Vercel, set `CHROMIUM_REMOTE_EXEC_PATH` to the Chromium pack URL matching your `@sparticuz/chromium` version.

---

## Project Structure (Key Paths)

```
app/
  layout.tsx              # Root layout, metadata, fonts, globals.css
  page.tsx                # Welcome: orientation video, audio check, code entry
  interview/
    page.tsx              # Virtual interview UI (gated by valid code)
    AudioControlsPill.tsx # In-call mute + mic/speaker selection (pill UI)
  admin/
    layout.tsx            # Admin layout (auth check)
    page.tsx              # Admin dashboard
    login/                # Login, forgot-password, reset-password
    register/page.tsx     # Register candidate
    requisitions/         # Requisitions list and management
    live/page.tsx         # Live sessions list
    live/[id]/page.tsx    # Live observation (transcript + TTS)
    developer/page.tsx   # Developer tools (compile, evaluate, deliver, Pushover test)
    settings/page.tsx    # Instruction preface, report delivery email
    users/               # User management
  api/                    # See “API Routes” above
  globals.css             # Tailwind + design tokens
lib/
  db.ts                   # Neon serverless SQL client
  aggregate-interview-data.ts  # Build aggregated prompt for evaluation
  openai-evaluation.ts   # OpenAI screening evaluation
  report-delivery.ts     # PDF generation + Resend email
  pushover.ts            # Pushover notifications
  admin-auth.ts          # Admin session and role checks
schema/
  001_initial.sql        # Core schema (users, requisitions, interviews, transcripts, reports, etc.)
  README.md              # How to run schema and migrations
docs/
  phase-6-2-ai-evaluation-spec.md  # AI evaluation output spec
public/
  wvs_logo.png
  speaker_test.mp3       # Audio check sample
```

---

## Design & Theming

- **Design system** in `app/globals.css`: `--bg-color`, `--card-bg`, `--text-primary`, `--text-secondary`, `--accent-red`, `--radius-*`, `--shadow-*`, `--bg-general`, `--border-line`, etc.  
- **Layout:** Sticky header, responsive main (video + transcript), pill-style nav and Audio Controls.  
- **Audio Controls pill:** Frosted pill (`bg-[rgba(255,255,255,0.25)]`, `backdrop-blur-sm`); 40×40 circular buttons; device list and setSinkId only when user opens popover to avoid competing with HeyGen for mic/video on session start.

---

## Notes for Developers

- **Sandbox vs production:** Toggle `LIVEAVATAR_SANDBOX_MODE` and set `NEXT_PUBLIC_AVATAR_ID` for the correct avatar.  
- **Interview code reuse:** Same code is allowed within **31 minutes** of `started_at` regardless of status (e.g. COMPLETED); completion then reprocesses with latest transcript.  
- **Transcript persistence:** Segments are sent to the API with debouncing and stored in `transcript_segments`; used for live observation, aggregation, and the report.  
- **TTS (live observation):** OpenAI TTS (gpt-4o-mini-tts); device list and playback are deferred until popover open / after stream ready to avoid affecting the candidate’s avatar stream.  
- **Metadata:** Update default metadata in `layout.tsx` (title, description) for production.

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)  
- [HeyGen Live Avatar](https://www.heygen.com/) — avatar and session API  
- [Neon](https://neon.tech/docs) — serverless Postgres  
- [Resend](https://resend.com/docs) — email and domain verification  
