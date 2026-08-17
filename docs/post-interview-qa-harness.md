# Post-Interview Report QA Harness

This SUPER_ADMIN-only tool at `/admin/report-qa` accepts the raw ingredients normally assembled after a LiveAvatar interview, persists an immutable QA snapshot, and runs the ordinary aggregation → OpenAI evaluation → PDF → Resend delivery pipeline.

## Status ledger

Update each identifier with `PENDING`, `IN_PROGRESS`, `BLOCKED`, or `COMPLETE`.

| Phase | Status | Evidence |
|---|---|---|
| PH-00 Discovery and architecture | COMPLETE | Baseline commit and production deployment inspected. |
| PH-01 Environment and test isolation | COMPLETE | Feature branch created; baseline build recorded; isolated Neon branch `test/report-qa-20260817` created, validated, and removed after release. |
| PH-02 Schema and contracts | COMPLETE | Migration 007 and versioned input validation implemented and tested on the isolated branch. |
| PH-03 Shared pipeline | COMPLETE | Candidate and QA workflows share compilation, evaluation, PDF, and delivery services. |
| PH-04 APIs and security | COMPLETE | SUPER_ADMIN APIs, current-role revalidation, auditing, retry, and operational-list isolation implemented. |
| PH-05 Admin interface | COMPLETE | Ingredient form, stage polling, history, details, and retry UI implemented. |
| PH-06 Automated validation | COMPLETE | Unit, isolated-database integration, authenticated/anonymous browser, typecheck, scoped lint, and production build checks pass. Repository-wide lint retains documented baseline errors outside this feature. |
| PH-07 Representative E2E | COMPLETE | Preview run `ccc6dde8-c349-463c-a619-668ede525bda` completed real OpenAI, Chromium PDF, Resend, mailbox receipt, and visual PDF inspection without registration or LiveAvatar. |
| PH-08 Independent QA | COMPLETE | Functional and Technical QA completed independent reviews; every material code finding was corrected and re-reviewed. |
| PH-09 Production rollout | COMPLETE | Migration 007 applied first; PR #1 merged; deployment `dpl_B9ZjwLENU4NUVN4GKexwDZRvFr2u` reached READY; production run `ee24232e-9a92-48f5-b628-ed62c67052fc` completed and was received. |
| PH-10 Documentation and handoff | COMPLETE | README, schema notes, this reference, validation evidence, rollout identifiers, and known limitations are recorded. |

## Input schema v1

- System instruction preface.
- Candidate first name, last name, email, and resume text.
- Job title, requirements, qualifications, skills, and job-analysis instructions.
- Interview start, end, and duration.
- Ordered transcript segments with `USER` (Candidate) or `AVATAR` (Interviewer), content, and optional millisecond offset.

Optional fields may be blank so insufficient-evidence behavior can be tested. Candidate names, a valid candidate email, and job title are required.

## Persistence and isolation

`admin_qa_report_runs` stores the immutable input JSON, actor, processing state, attempt count, delivery message ID, failure stage, sanitized error, and timestamps. A synthetic completed `interviews` row provides the foreign key expected by `interview_reports`; it is never shown as a candidate, live session, developer-tool interview, job-title source, or valid access code.

The exact instruction preface is snapshotted in `interview_reports.instruction_preface_snapshot`. This keeps a compiled run deterministic if global settings change before evaluation or retry.

## API

- `GET /api/admin/report-qa/runs` — recent QA history plus current instruction/delivery settings.
- `POST /api/admin/report-qa/runs` — validate, transactionally persist, process, and deliver a scenario.
- `GET /api/admin/report-qa/runs/[id]` — complete run detail, input, prompt, and evaluation.
- `POST /api/admin/report-qa/runs/[id]/retry` — atomically resume a failed run at its failed stage, or recover a processing run abandoned for at least ten minutes.

All endpoints revalidate that the signed-in user is still active and currently has the `SUPER_ADMIN` database role.

## Operational notes

- A successful run sends a real email to `system_settings.report_delivery_email`.
- A failed run remains retained and retryable. Retrying delivery does not rerun OpenAI; retrying evaluation does not recreate inputs. Concurrent retries use an optimistic claim, and stage updates are bound to the current processing attempt.
- QA delivery uses one stable Resend idempotency key per run. The renderer escapes raw model HTML, omits remote Markdown images, disables JavaScript, and blocks network requests before creating the PDF.
- Inputs contain candidate-like PII and follow the same retention and access expectations as interview records.
- Apply `schema/007_admin_qa_report_runs.sql` before deploying code that references the new table and column.

## Release validation evidence

- Commit: `d5d48ab94ab69a21fd38a81afd2059f67ed066d6`, merged by GitHub PR #1.
- Production deployment: `dpl_B9ZjwLENU4NUVN4GKexwDZRvFr2u`, READY and aliased to `recruiter.wvsupply.com`.
- Isolated Neon/Vitest suite: 5 files, 17 tests passed.
- Vitest without database credentials: 13 passed and 4 database tests skipped by design.
- Playwright: 4 tests passed, covering anonymous denial, current-role authorization, stale-role demotion, controlled downstream failure, input preservation, and operational isolation.
- `npm run typecheck`, scoped feature ESLint, `npm run build`, and `git diff --check` passed.
- Preview E2E: run `ccc6dde8-c349-463c-a619-668ede525bda`; model `gpt-5-mini`; 486 input and 2,221 output tokens; delivery message `3b3c1b2b-c7db-46bc-a385-4562328df3da`; received PDF inspected across all three pages.
- Production E2E: run `ee24232e-9a92-48f5-b628-ed62c67052fc`; model `gpt-5-mini`; 516 input and 2,713 output tokens; delivery message `63bfa9e3-37ab-4b8f-a7c0-a38b81ab26c6`; received PDF inspected for evaluation, resume, and ordered transcript sections.
- Production isolation: the synthetic candidate was absent from candidate, developer, and live-session APIs. A demoted ADMIN received a page redirect and API 403; the subsequently deactivated test identity could not authenticate.
- Functional QA: conditional pass before live external smoke; all functional findings were corrected and re-reviewed. The later preview and production E2E executions satisfied the remaining external condition.
- Technical QA: code-review pass after targeted corrections and reruns; no material code defect remained. The later preview and production E2E executions satisfied the remaining external condition.
- Watchdog: not used; the request did not require one and both independent QA reviews completed.

Known repository-wide limitations are not hidden by the feature checks: the existing full-repository lint command still reports 29 errors and 16 warnings in unrelated baseline files. `npm audit --omit=dev --audit-level=high` reports seven high-severity production dependency advisories whose suggested fixes require out-of-range Next.js and Puppeteer upgrades. Vercel also reports dependency-level `url.parse()` and middleware-convention deprecation warnings; the production smoke itself returned only HTTP 200 and 201 responses.

