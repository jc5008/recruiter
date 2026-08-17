# Post-Interview Report QA Harness

This SUPER_ADMIN-only tool at `/admin/report-qa` accepts the raw ingredients normally assembled after a LiveAvatar interview, persists an immutable QA snapshot, and runs the ordinary aggregation → OpenAI evaluation → PDF → Resend delivery pipeline.

## Status ledger

Update each identifier with `PENDING`, `IN_PROGRESS`, `BLOCKED`, or `COMPLETE`.

| Phase | Status | Evidence |
|---|---|---|
| PH-00 Discovery and architecture | COMPLETE | Baseline commit and production deployment inspected. |
| PH-01 Environment and test isolation | COMPLETE | Feature branch created; baseline build recorded; Neon branch `test/report-qa-20260817` created. |
| PH-02 Schema and contracts | COMPLETE | Migration 007 and versioned input validation implemented and tested on the isolated branch. |
| PH-03 Shared pipeline | COMPLETE | Candidate and QA workflows share compilation, evaluation, PDF, and delivery services. |
| PH-04 APIs and security | COMPLETE | SUPER_ADMIN APIs, current-role revalidation, auditing, retry, and operational-list isolation implemented. |
| PH-05 Admin interface | COMPLETE | Ingredient form, stage polling, history, details, and retry UI implemented. |
| PH-06 Automated validation | COMPLETE | Unit, isolated-database integration, authenticated/anonymous browser, typecheck, scoped lint, and production build checks pass. Repository-wide lint retains documented baseline errors outside this feature. |
| PH-07 Representative E2E | IN_PROGRESS | Isolated browser flow reaches controlled OpenAI failure without registration/LiveAvatar; real OpenAI/PDF/Resend preview and production smoke remain. |
| PH-08 Independent QA | IN_PROGRESS | Functional and Technical QA completed initial reviews; corrections and targeted re-reviews are underway. |
| PH-09 Production rollout | PENDING | Migration first, then reviewed deployment and production smoke. |
| PH-10 Documentation and handoff | IN_PROGRESS | This reference and README/schema notes added; final evidence pending. |

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
