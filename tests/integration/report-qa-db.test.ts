import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db';
import { aggregateInterviewData, buildAggregatedPrompt } from '@/lib/aggregate-interview-data';
import { compileInterviewReport } from '@/lib/post-interview-report';
import type { QaReportInput } from '@/lib/report-qa';
import { claimQaRunForRetry, persistQaRun } from '@/lib/report-qa-runs';
import { createSessionCookie } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';

const enabled = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.sql_DATABASE_URL);

describe.runIf(enabled)('QA report database integration', () => {
  let sql!: ReturnType<typeof getSql>;
  const userId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const deactivatedUserId = crypto.randomUUID();
  let interviewId = '';
  const runId = crypto.randomUUID();
  let accessCode = '';
  const input: QaReportInput = {
    system_instruction_preface: 'Database integration system instructions',
    candidate: {
      first_name: 'Integration',
      last_name: 'Candidate',
      email: `qa-${runId}@example.invalid`,
      resume_text: 'Integration resume',
    },
    job: {
      title: 'Integration Job',
      requirements: 'Integration requirements',
      qualifications: 'Integration qualifications',
      skills: 'Integration skills',
      job_analysis_instructions: 'Integration job instructions',
    },
    interview: {
      started_at: '2026-08-17T00:00:00.000Z',
      ended_at: '2026-08-17T00:10:00.000Z',
      duration_seconds: 600,
    },
    transcript: [
      { speaker: 'AVATAR', content: 'Integration question', timestamp_offset_ms: 0 },
      { speaker: 'USER', content: 'Integration answer', timestamp_offset_ms: 1_000 },
    ],
  };

  beforeAll(async () => {
    sql = getSql();
    await sql`INSERT INTO users (id, email, password_hash, first_name, last_name, role, status)
      VALUES (${userId}, ${`qa-admin-${runId}@example.invalid`}, 'not-used', 'QA', 'Admin', 'SUPER_ADMIN', 'ACTIVE')`;
    await sql`INSERT INTO users (id, email, password_hash, first_name, last_name, role, status)
      VALUES
        (${adminUserId}, ${`qa-standard-${runId}@example.invalid`}, 'not-used', 'QA', 'Standard', 'ADMIN', 'ACTIVE'),
        (${deactivatedUserId}, ${`qa-deactivated-${runId}@example.invalid`}, 'not-used', 'QA', 'Deactivated', 'SUPER_ADMIN', 'DEACTIVATED')`;
    const persisted = await persistQaRun({ run_id: runId, scenario_name: 'Integration', input }, userId);
    interviewId = persisted.interviewId;
    accessCode = persisted.internalAccessCode;
  });

  afterAll(async () => {
    await sql`DELETE FROM interviews WHERE id = ${interviewId}`;
    await sql`DELETE FROM audit_logs WHERE actor_user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id IN (${userId}, ${adminUserId}, ${deactivatedUserId})`;
  });

  it('aggregates the immutable QA snapshot and stores the exact instruction snapshot', async () => {
    const aggregated = await aggregateInterviewData(interviewId);
    expect(aggregated.system_instruction_preface).toBe(input.system_instruction_preface);
    expect(aggregated.requisition?.job_title).toBe(input.job.title);
    expect(aggregated.transcript.map((segment) => segment.content)).toEqual(['Integration question', 'Integration answer']);

    const compiled = await compileInterviewReport(interviewId);
    expect(compiled.transcript_segments).toBe(2);
    const reportRows = await sql`
      SELECT aggregated_prompt_text, instruction_preface_snapshot
      FROM interview_reports WHERE interview_id = ${interviewId}
    `;
    expect(reportRows[0]?.instruction_preface_snapshot).toBe(input.system_instruction_preface);
    expect(reportRows[0]?.aggregated_prompt_text).toBe(buildAggregatedPrompt(aggregated));
  });

  it('cannot use the synthetic access code through the public validation route', async () => {
    const { POST } = await import('@/app/api/validate-code/route');
    const response = await POST(new Request('http://localhost/api/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: accessCode }),
    }));
    expect(response.status).toBe(404);
  });

  it('authorizes from the active database role, not a stale signed-cookie role', async () => {
    async function requestFor(userIdValue: string, email: string, role: string) {
      const cookie = await createSessionCookie({ userId: userIdValue, email, role });
      return new NextRequest('http://localhost/api/admin/report-qa/runs', {
        headers: { cookie: `admin_session=${encodeURIComponent(cookie)}` },
      });
    }

    const superRequest = await requestFor(userId, `qa-admin-${runId}@example.invalid`, 'ADMIN');
    const superResult = await requireSuperAdmin(superRequest);
    expect(superResult).not.toBeInstanceOf(NextResponse);

    const demotedRequest = await requestFor(adminUserId, `qa-standard-${runId}@example.invalid`, 'SUPER_ADMIN');
    const demotedResult = await requireSuperAdmin(demotedRequest);
    expect(demotedResult).toBeInstanceOf(NextResponse);
    expect((demotedResult as NextResponse).status).toBe(403);

    const deactivatedRequest = await requestFor(deactivatedUserId, `qa-deactivated-${runId}@example.invalid`, 'SUPER_ADMIN');
    const deactivatedResult = await requireSuperAdmin(deactivatedRequest);
    expect(deactivatedResult).toBeInstanceOf(NextResponse);
    expect((deactivatedResult as NextResponse).status).toBe(401);
  });

  it('atomically claims one concurrent retry and can recover a stale processing stage', async () => {
    await sql`
      UPDATE admin_qa_report_runs
      SET status = 'FAILED', failed_stage = 'EVALUATING', error_message = 'controlled failure',
          processing_attempt_id = NULL, attempt_count = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${runId}
    `;

    const concurrent = await Promise.all([
      claimQaRunForRetry(runId),
      claimQaRunForRetry(runId),
    ]);
    expect(concurrent.filter((result) => result.ok)).toHaveLength(1);
    expect(concurrent.filter((result) => !result.ok && result.status === 409)).toHaveLength(1);

    await sql`
      UPDATE admin_qa_report_runs
      SET status = 'EVALUATING', failed_stage = NULL,
          updated_at = CURRENT_TIMESTAMP - INTERVAL '11 minutes'
      WHERE id = ${runId}
    `;
    const staleClaim = await claimQaRunForRetry(runId);
    expect(staleClaim).toMatchObject({
      ok: true,
      startAt: 'EVALUATING',
      staleRecovery: true,
    });

    await sql`
      UPDATE admin_qa_report_runs
      SET status = 'PERSISTED', failed_stage = NULL,
          updated_at = CURRENT_TIMESTAMP - INTERVAL '11 minutes'
      WHERE id = ${runId}
    `;
    const persistedClaim = await claimQaRunForRetry(runId);
    expect(persistedClaim).toMatchObject({
      ok: true,
      startAt: 'AGGREGATING',
      staleRecovery: true,
    });

    const counts = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM admin_qa_report_runs WHERE id = ${runId}) AS runs,
        (SELECT COUNT(*)::int FROM interviews WHERE id = ${interviewId}) AS interviews,
        (SELECT COUNT(*)::int FROM transcript_segments WHERE interview_id = ${interviewId}) AS segments
    `;
    expect(counts[0]).toMatchObject({ runs: 1, interviews: 1, segments: 2 });
  });
});
