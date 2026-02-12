# Virtual Interviewer — Project Next Steps

This document interprets the **Virtual Interviewer Project Description** (Feb 8, 2026) and turns it into ordered next steps. It assumes the **current build**: single-page virtual interview with HeyGen Live Avatar, live transcript, audio device test popup, Settings/Help, and Diagnostics.

---

## Summary: What’s New vs. Current Build

| Area | Current | From Project Description |
|------|---------|---------------------------|
| **Candidate flow** | Start Interview → Live session → Leave | **Interview Code** entry → **Orientation video** → **Audio check** → Start → Leave → **Thank You** page |
| **Session code** | None | Unique code per candidate; validate; 30‑min reuse; transcript append on same code |
| **Transcript** | In-memory only | Persist to DB; feed post-interview AI and observation |
| **Admin** | None | **Admin portal**: login, register candidates, requisitions, live observation (TTS), user/requisition/settings management |
| **Post-interview** | None | **AI evaluation** (OpenAI GPT-4o), **PDF report**, email to hr.automations@wvsupply.com |
| **Security** | None | Rate limits, lockout, audit logs for codes and admin |
| **Data** | None | Full **SQL schema** (users, requisitions, interviews, transcripts, reports, audit, system_settings) |

---

## Phase 1: Data & Access Foundation

**Goal:** Persistent data and secure, code-gated candidate access so the rest of the system can rely on it.

### 1.1 Database Setup

- **Stack:** Doc specifies Vercel + Neon (direct integration). **Done in repo:** `@neondatabase/serverless`, `lib/db.ts`, `schema/001_initial.sql`, `schema/README.md`.
- **Schema:** Full SQL is in `schema/001_initial.sql` (in order):
  1. `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  2. **User management:** `user_role`, `user_status`, `users`
  3. **Requisitions:** `req_status`, `requisitions`
  4. **Interviews:** `interview_status`, `interviews` (candidate info, `access_code`, `deadline_at`, `requisition_id`, etc.)
  5. **Transcript & observation:** `speaker_type`, `transcript_segments`, `observation_audio`
  6. **Reports:** `interview_reports` (e.g. `ai_evaluation_json`, `pdf_report_url`, token usage, email status)
  7. **Audit & config:** `audit_logs`, `system_settings`
- **Next steps:** Create a Neon project, run `schema/001_initial.sql` once (see `schema/README.md`), set `sql_DATABASE_URL` in `.env.local`, then add API routes or Server Actions that use `getSql()` from `lib/db.ts` for interviews and codes.

### 1.2 Interview Code Lifecycle

- **Generate:** Unique `access_code` when HR registers a candidate; store with `interviews` row and `deadline_at`.
- **Validate:** Candidate-facing endpoint/page: accept code, check exists + active + not expired + not already “used” per policy (e.g. allow reuse within 30‑min window).
- **Session code behavior (from doc):**
  - Reuse same code within 30‑min window of first start.
  - If candidate leaves and rejoins: session can “restart” questions, but **previous responses/transcript are kept**; **append** new transcript to existing for that interview.
- **Next steps:** API or server action to validate code and return interview/session context; candidate UI calls it before proceeding to orientation.

### 1.3 Candidate Entry Flow (Replace Direct “Start Interview”)

- **Welcome screen:** Brief explanation, privacy/recording notice, **Interview Code** input, “Continue”.
- **Validation:** On submit, validate code; on failure show clear error and retry/support guidance.
- **After valid code:** Redirect to orientation (or in-app transition).
- **Next steps:** New route (e.g. `/` or `/interview`) with welcome + code form; move current “Start Interview” behind code validation and orientation.

---

## Phase 2: Candidate Experience (Orientation, Audio, Thank You)

**Goal:** Match the doc’s candidate journey: orientation → audio check → interview → thank you.

### 2.1 Orientation & Flow Order

- **Order (doc):** “Watch the video → Test the Audio → Enter the interview code.”  
  **Clarification for implementation:** Code is entered on the **welcome** screen (before orientation). After code validation, show **orientation** then **audio check** then **Start Interview**.
- **Orientation screen:**
  - Short **instructional video** (use the “Virtual Interview Preparation Video Script” from the doc for voiceover/content).
  - Covers: format, how to interact, expected conduct, audio/video usage, how to end session.
  - Actions: Restart video, “Start Interview” when ready.
- **Next steps:** Add `/orientation` (or equivalent) with video player and script-based content; after “Start Interview” go to current interview page (with session tied to validated `interview_id`).

### 2.2 Audio Check and Code

- **Current:** Audio test popup on load (speaker + mic).
- **Change:** Show audio test **after** code validation and orientation, before “Start Interview” (so flow is: code → orientation → audio check → start). Keep “Test audio devices” in Settings for later use.
- **Optional:** Use selected mic/speaker (from Settings) when creating HeyGen session (doc notes this as a possible follow-up).

### 2.3 Session Reuse and Transcript Append

- **30‑minute window:** If the same interview code is used again within 30 minutes of first start, treat as same “session” (e.g. same `interview_id`); allow re-entry to live interview or resume flow.
- **Transcript:** When same code is used again, **append** new transcript segments to the existing transcript for that `interview_id` (don’t replace).
- **Next steps:** When creating/joining session, check for existing `interview_id` and recent `started_at`; if within window, reuse and append transcript; otherwise create new session/segment set.

### 2.4 Thank You Page

- **When:** After candidate clicks “Leave Interview,” end session then **redirect to Thank You page**.
- **Content:** Completion confirmation, next steps, contact info.
- **Next steps:** Add route (e.g. `/thank-you`) and redirect from “Leave Interview” handler; optionally pass `interview_id` for “Your interview has been submitted” messaging.

### 2.5 Privacy and Metadata

- **Privacy:** Add privacy disclosure on site (doc: “Add privacy disclosure on site”).
- **Metadata:** Update `layout.tsx` (e.g. title “Virtual Interview | WV Supply”, description) as in current README notes.

---

## Phase 3: Transcript Persistence & Countdown

**Goal:** Save transcript for analysis and observation; add time cues for candidate.

### 3.1 Persist Transcript

- **Current:** Transcript only in React state; lost on refresh/leave.
- **Target:** On each `user.transcription` / `avatar.transcription` (and any segment boundaries), persist to `transcript_segments` with `interview_id`, `speaker`, `content`, `timestamp_offset_ms`.
- **Next steps:** After session is tied to `interview_id`, send segments to API that writes to `transcript_segments`; consider batching or debouncing to limit writes.

### 3.2 Countdown / Time Remaining

- **Doc:** “15 minutes” target; progress bar “extremely subtle” first 10 min, “more obvious” last 5 min.
- **Notifications:** At 10 min → “5 minutes remaining”; at 12 min → “2 minutes remaining”; at 14 min → “1 minute remaining.”
- **Next steps:** Track session start time; timer component or effect that updates a progress bar and shows the three notifications at 10/12/14 min; optional soft “session ending soon” (no hard cutoff specified in doc).

---

## Phase 4: Admin Portal — Auth & Core HR

**Goal:** Secure admin app for HR staff: login, register candidates, manage requisitions.

### 4.1 Admin App and Auth

- **Scope:** Separate “Admin web page” (e.g. `/admin` or subdomain) with login.
- **Auth:** Employee credentials; roles from schema: `SUPER_ADMIN`, `ADMIN`, `OBSERVER`, `AUDITOR`.
- **Security (high level):** Rate limiting and lockout on login; audit log for attempts (see Phase 7).
- **Next steps:** Add admin layout/routes; choose auth (e.g. NextAuth, Clerk, or custom with `users` table); implement login and role checks.

### 4.2 Register New Candidate (HR)

- **Form (required):** Candidate First Name, Last Name, Job Title (from approved list/requisitions), Candidate Email, Interview Access Deadline (default 5 days from today, editable), Resume (plain text), Registrant Name (pre-filled from logged-in user; editable only by Super Admin).
- **Submit:** Validate required fields, email format, deadline in future, job title authorized. Then create `interviews` row, generate unique `access_code`, timestamp, log.
- **Confirmation screen:** Candidate name, job title, deadline, **Interview Code**, **Copy to Clipboard** button with brief “Copied” feedback.
- **Email:** Send confirmation to **hr.automations@wvsupply.com** (and optionally invitation to candidate).
- **Next steps:** Admin page “Register New Candidate”; form → API/server action → DB + code generation + email (e.g. Resend, SendGrid); confirmation UI with clipboard API.

### 4.3 Job Requisitions (HR)

- **Create Requisition:** Job Requisition Number (unique), Post Date, Job Title, Job Requirements, Qualifications, Skills (content for AI prompts). Save to `requisitions`; status Active; show in “Active Requisitions.”
- **Integration:** Job Title and Requisition Number available in candidate registration (dropdown); job requirements used later for AI interview context and evaluation.
- **Requisition Management / Deactivate:** List requisitions (number, title, status, dates); “Deactivate” with confirmation; deactivated requisitions removed from registration dropdowns; existing interviews unaffected.
- **Next steps:** CRUD (or create + list + deactivate) for requisitions; wire dropdowns in registration to `requisitions` where status = Active.

---

## Phase 5: Admin — Live Observation (TTS)

**Goal:** HR can watch live sessions and hear a TTS-recreated version of the conversation only while observing.

### 5.1 View Live Sessions

- **Menu:** “View Live Sessions” in admin.
- **List:** Active interviews: Candidate First/Last Name, Position Title, Session Status (Active / Paused / Ending), Observer Count.
- **Select session:** Open Live Observation View.

### 5.2 Live Observation View

- **Content:** Real-time transcript, session metadata, audio playback controls (pause, resume, volume, mute).
- **TTS rule:** Only when **at least one** observer is viewing this session:
  - Subscribe to transcript events for that interview (from `transcript_segments` or live stream).
  - For each new segment: identify speaker → send text to TTS → choose voice → add to playback queue; play in order for near–real-time “recreated” conversation.
  - If streaming TTS is used, start playback before full generation for lower latency.
- **When all observers leave:** Stop TTS immediately; no retroactive generation for skipped segments (unless explicitly requested later).
- **When observer rejoins:** Resume TTS from that point; do not backfill skipped segments by default.
- **Persistence:** Mark segments as `is_processed_for_tts`; optionally store generated audio in `observation_audio` for audit/replay.
- **Next steps:** Real-time feed of transcript (e.g. polling or WebSocket from `transcript_segments` or HeyGen/LiveKit); TTS service (e.g. OpenAI TTS, ElevenLabs); queue and playback in browser; observer count so backend only runs TTS when count > 0.

**Deferred — Live Sessions / sandbox avatar:** If Live Sessions (list or observation) still do not behave as expected after the start-API fix (setting `status = 'ACTIVE'` when the candidate starts the interview), we will hold off on further debugging until the app is switched from the HeyGen **sandbox** avatar to the production avatar identified in `.env.local` (e.g. `NEXT_PUBLIC_AVATAR_ID`). Resolve any remaining Live Session issues after that switch (see Phase 8).

---

## Phase 6: Post-Interview Analysis & Reports

**Goal:** When an interview is completed, run AI evaluation and email a PDF report.

### 6.1 Trigger and Data Aggregation

- **Trigger:** When session ends (candidate leaves), mark interview completed and kick off processing (e.g. queue job or serverless).
- **Aggregate:** Candidate identity, job title, requisition ID, timestamps, duration, resume (plain text), **full transcript**, system instructions, job requirements (from requisition).

### 6.2 AI Evaluation

- **Model:** OpenAI GPT-4o via API.
- **Input:** Assembled “content package” (e.g. system instruction preface from `system_settings`, job requirements, transcript, resume).
- **Output:** Structured evaluation (e.g. competency scores, question analysis); store in `interview_reports.ai_evaluation_json`; preserve formatting; retry on transient failures.

### 6.3 Report Generation and Delivery

- **PDF:** Generate standardized Post-Interview Report (candidate/role metadata, duration, token usage, overview, question analysis, competency evaluations, system observations); version/archive.
- **Email:** Send report to **hr.automations@wvsupply.com**; update `email_delivery_status`; log failures and alert admins.
- **Next steps:** Server-side job or API that: loads interview + transcript + requisition; calls GPT-4o; builds PDF (e.g. React-PDF, Puppeteer, or server-side lib); sends email; writes to `interview_reports`.

---

## Phase 7: Admin — Users, Settings, Security

**Goal:** Super Admin can manage users and system text; platform-wide security and audit.

### 7.1 Super Admin: User Management

- **User Management:** List/search admins (name, username/email, role, status, last login). Add user (name, email, role, scope, notes); send secure onboarding/temp credentials. Edit user (role, scope, contact, status). Deactivate user (confirm; revoke access, preserve history).
- **Audit:** Log creation, role changes, deactivations, failed access; filter/export for authorized users.
- **Next steps:** Admin UI for user CRUD; enforce “Super Admin only”; integrate with auth provider or `users` table; audit writes to `audit_logs`.

### 7.2 Super Admin: Instruction Preface

- **System Settings → Standard Instruction Preface:** Editable text used as the system instruction for AI analysis. Save to `system_settings`; apply to all future analyses (no retroactive).
- **Next steps:** Single settings page; load/save `system_settings.key = 'instruction_preface'`; use this value when calling GPT-4o in Phase 6.

### 7.3 Secure Access Across Platform

- **Scope:** Interview code submission, admin login, session creation, webhooks, internal tools.
- **Log every attempt:** Identifier (code or username), IP, timestamp, user agent, result (success/failure/blocked).
- **Rate limits:** Code submissions, login attempts, API/session start; progressive throttling and temporary blocks; no sensitive feedback.
- **Credential access:** Account lockout; alerts for abnormal patterns.
- **Code access:** Detect guessing/enumeration; block enumeration.
- **Next steps:** Middleware or API-level rate limiting (e.g. Upstash, in-memory); audit_logs for all access events; lockout and alerting rules; keep logs immutable and retained per policy.

---

## Phase 8: Polish & Production Readiness

- **Sandbox → production:** Switch HeyGen to non-sandbox avatar and secure API keys/env.
- **Wire selected mic/speaker** into HeyGen session if supported by SDK.
- **Testing:** E2E for candidate flow (code → orientation → audio → interview → thank you) and admin registration → code copy → email.
- **Documentation:** Update README with admin setup, env vars (DB, auth, TTS, OpenAI, email), and deployment notes.

---

## Suggested Implementation Order (High Level)

1. **Phase 1** — DB, interview code generation/validation, candidate welcome + code gate.
2. **Phase 2** — Orientation video, audio check order, thank you page, privacy/metadata; session reuse and transcript append.
3. **Phase 3** — Transcript persistence; 15‑min countdown and notifications.
4. **Phase 4** — Admin auth, register candidate, requisitions (create + deactivate).
5. **Phase 7.3** — Security and audit (can start in parallel with 4).
6. **Phase 5** — Live observation and TTS.
7. **Phase 6** — Post-interview AI evaluation and PDF email.
8. **Phase 7.1–7.2** — User management and instruction preface.
9. **Phase 8** — Production and polish.

---

## Reference: Preparation Video Script

The doc includes a “Virtual Interview Preparation Video Script” (friendly intro, what to expect, how to interact, 10–15 min, no trick questions, audio check, Interview Code, transcript for HR, “Leave Interview” button, thank you). Use it for the orientation video voiceover and/or on-screen copy.

---

## Reference: SQL Schema Location

The full schema is in **`schema/001_initial.sql`** (users, requisitions, interviews, transcript_segments, observation_audio, interview_reports, audit_logs, system_settings). Run it once on a new Neon database; see **`schema/README.md`** for how to run it.
