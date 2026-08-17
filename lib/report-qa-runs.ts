import { getSql } from './db';
import { processPostInterviewReport, type ReportProcessingResult } from './post-interview-report';
import {
  QA_INPUT_SCHEMA_VERSION,
  sanitizeQaError,
  type QaFailedStage,
  type QaReportPayload,
} from './report-qa';

export type QaRunSummary = {
  id: string;
  interview_id: string;
  scenario_name: string | null;
  status: string;
  failed_stage: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by_name: string;
  created_by_email: string;
  candidate_name: string;
  candidate_email: string;
  model: string | null;
  token_usage_input: number | null;
  token_usage_output: number | null;
  email_delivery_status: string | null;
  delivery_message_id: string | null;
  attempt_count: number;
  can_retry: boolean;
};

const STALE_RUN_MS = 10 * 60 * 1_000;

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function canRetry(status: unknown, updatedAt: unknown): boolean {
  if (status === 'FAILED') return true;
  if (
    status !== 'PERSISTED'
    && status !== 'AGGREGATING'
    && status !== 'EVALUATING'
    && status !== 'DELIVERING'
  ) return false;
  const updated = new Date(updatedAt as string | number | Date).getTime();
  return Number.isFinite(updated) && updated < Date.now() - STALE_RUN_MS;
}

async function writeQaAudit(
  actorUserId: string,
  eventType: string,
  runId: string,
  outcome: 'SUCCESS' | 'FAILED',
  details: Record<string, unknown>
) {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO audit_logs (actor_user_id, event_type, resource_target, outcome, details)
      VALUES (${actorUserId}, ${eventType}, ${runId}, ${outcome}, ${JSON.stringify(details)})
    `;
  } catch {
    // Audit logging is auxiliary after the run has been persisted. Do not turn a
    // completed external delivery into a retryable failure because this insert failed.
    console.error('QA report audit write failed');
  }
}

async function getCurrentFailedStage(runId: string, fallback: QaFailedStage): Promise<QaFailedStage> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT status
      FROM admin_qa_report_runs
      WHERE id = ${runId}
      LIMIT 1
    `;
    const status = rows[0]?.status;
    if (status === 'AGGREGATING' || status === 'EVALUATING' || status === 'DELIVERING') {
      return status;
    }
  } catch {
    console.error('QA report stage recovery lookup failed');
  }
  return fallback;
}

export async function persistQaRun(payload: QaReportPayload, actorUserId: string) {
  const sql = getSql();
  const runId = payload.run_id || crypto.randomUUID();
  const interviewId = crypto.randomUUID();
  const input = payload.input;
  const now = new Date();
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  const internalAccessCode = `QA${interviewId.replace(/-/g, '').slice(0, 16)}`;
  const startedAt = input.interview.started_at ? new Date(input.interview.started_at) : null;
  const endedAt = input.interview.ended_at ? new Date(input.interview.ended_at) : null;
  const transcriptBase = startedAt?.getTime() ?? now.getTime();

  const queries = [
    sql`
      INSERT INTO interviews (
        id, candidate_first_name, candidate_last_name, candidate_email,
        resume_text, requisition_id, access_code, deadline_at, status,
        started_at, ended_at, duration_seconds, registered_by
      )
      VALUES (
        ${interviewId}, ${input.candidate.first_name}, ${input.candidate.last_name}, ${input.candidate.email},
        ${input.candidate.resume_text || null}, NULL, ${internalAccessCode}, ${deadline}, 'COMPLETED',
        ${startedAt}, ${endedAt}, ${input.interview.duration_seconds}, ${actorUserId}
      )
    `,
    ...input.transcript.map((segment, index) => sql`
      INSERT INTO transcript_segments (
        interview_id, speaker, content, timestamp_offset_ms, created_at
      )
      VALUES (
        ${interviewId}, ${segment.speaker}, ${segment.content}, ${segment.timestamp_offset_ms},
        ${new Date(transcriptBase + (segment.timestamp_offset_ms ?? index))}
      )
    `),
    sql`
      INSERT INTO admin_qa_report_runs (
        id, interview_id, created_by, scenario_name, input_schema_version,
        input_json, status, processing_attempt_id
      )
      VALUES (
        ${runId}, ${interviewId}, ${actorUserId}, ${payload.scenario_name || null},
        ${QA_INPUT_SCHEMA_VERSION}, ${JSON.stringify(input)}, 'PERSISTED', ${runId}
      )
    `,
    sql`
      INSERT INTO audit_logs (actor_user_id, event_type, resource_target, outcome, details)
      VALUES (
        ${actorUserId}, 'QA_REPORT_CREATED', ${runId}, 'SUCCESS',
        ${JSON.stringify({ interview_id: interviewId, input_schema_version: QA_INPUT_SCHEMA_VERSION })}
      )
    `,
  ];

  await sql.transaction(queries);

  return { runId, interviewId, internalAccessCode };
}

export async function createAndProcessQaRun(payload: QaReportPayload, actorUserId: string) {
  const sql = getSql();
  const { runId, interviewId } = await persistQaRun(payload, actorUserId);

  let processing: ReportProcessingResult;
  try {
    processing = await processPostInterviewReport(interviewId, 'AGGREGATING', runId);
  } catch (error) {
    const message = sanitizeQaError(error);
    const failedStage = await getCurrentFailedStage(runId, 'AGGREGATING');
    await sql`
      UPDATE admin_qa_report_runs
      SET status = 'FAILED', failed_stage = ${failedStage}, error_message = ${message}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${runId}
    `;
    await writeQaAudit(actorUserId, 'QA_REPORT_FAILED', runId, 'FAILED', { failed_stage: failedStage, error: message });
    throw new Error(message);
  }

  if (processing.ok) {
    await writeQaAudit(actorUserId, 'QA_REPORT_COMPLETED', runId, 'SUCCESS', {
      interview_id: interviewId,
      model: processing.evaluation?.model,
      message_id: processing.delivery?.message_id,
    });
  } else {
    await writeQaAudit(actorUserId, 'QA_REPORT_FAILED', runId, 'FAILED', {
      failed_stage: processing.failed_stage,
      error: processing.error,
    });
  }

  return { run_id: runId, interview_id: interviewId, processing };
}

export async function listQaRuns(limit = 25): Promise<QaRunSummary[]> {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const rows = await sql`
    SELECT q.id, q.interview_id, q.scenario_name, q.status, q.failed_stage,
           q.error_message, q.created_at, q.updated_at, q.completed_at,
           q.delivery_message_id, q.attempt_count,
           u.first_name, u.last_name, u.email AS created_by_email,
           i.candidate_first_name, i.candidate_last_name, i.candidate_email,
           r.ai_evaluation_json, r.token_usage_input, r.token_usage_output,
           r.email_delivery_status
    FROM admin_qa_report_runs q
    JOIN users u ON u.id = q.created_by
    JOIN interviews i ON i.id = q.interview_id
    LEFT JOIN interview_reports r ON r.interview_id = q.interview_id
    ORDER BY q.created_at DESC
    LIMIT ${safeLimit}
  `;
  return rows.map((row) => {
    const evaluation = row.ai_evaluation_json as { model?: string } | null;
    return {
      id: String(row.id),
      interview_id: String(row.interview_id),
      scenario_name: row.scenario_name ? String(row.scenario_name) : null,
      status: String(row.status),
      failed_stage: row.failed_stage ? String(row.failed_stage) : null,
      error_message: row.error_message ? String(row.error_message) : null,
      created_at: iso(row.created_at)!,
      updated_at: iso(row.updated_at)!,
      completed_at: iso(row.completed_at),
      created_by_name: `${row.first_name} ${row.last_name}`.trim(),
      created_by_email: String(row.created_by_email),
      candidate_name: `${row.candidate_first_name} ${row.candidate_last_name}`.trim(),
      candidate_email: String(row.candidate_email),
      model: evaluation?.model ?? null,
      token_usage_input: row.token_usage_input == null ? null : Number(row.token_usage_input),
      token_usage_output: row.token_usage_output == null ? null : Number(row.token_usage_output),
      email_delivery_status: row.email_delivery_status ? String(row.email_delivery_status) : null,
      delivery_message_id: row.delivery_message_id ? String(row.delivery_message_id) : null,
      attempt_count: Number(row.attempt_count),
      can_retry: canRetry(row.status, row.updated_at),
    };
  });
}

export async function getQaRun(runId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT q.*, u.first_name, u.last_name, u.email AS created_by_email,
           i.candidate_first_name, i.candidate_last_name, i.candidate_email,
           r.aggregated_prompt_text, r.instruction_preface_snapshot,
           r.ai_evaluation_json, r.token_usage_input, r.token_usage_output,
           r.email_delivery_status
    FROM admin_qa_report_runs q
    JOIN users u ON u.id = q.created_by
    JOIN interviews i ON i.id = q.interview_id
    LEFT JOIN interview_reports r ON r.interview_id = q.interview_id
    WHERE q.id = ${runId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  const evaluation = row.ai_evaluation_json as { model?: string } | null;
  return {
    id: String(row.id),
    interview_id: String(row.interview_id),
    scenario_name: row.scenario_name ? String(row.scenario_name) : null,
    input_schema_version: Number(row.input_schema_version),
    input: row.input_json,
    status: String(row.status),
    failed_stage: row.failed_stage ? String(row.failed_stage) : null,
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    completed_at: iso(row.completed_at),
    created_by_name: `${row.first_name} ${row.last_name}`.trim(),
    created_by_email: String(row.created_by_email),
    candidate_name: `${row.candidate_first_name} ${row.candidate_last_name}`.trim(),
    candidate_email: String(row.candidate_email),
    model: evaluation?.model ?? null,
    aggregated_prompt_text: row.aggregated_prompt_text ? String(row.aggregated_prompt_text) : null,
    instruction_preface_snapshot: row.instruction_preface_snapshot == null ? null : String(row.instruction_preface_snapshot),
    ai_evaluation_json: row.ai_evaluation_json,
    token_usage_input: row.token_usage_input == null ? null : Number(row.token_usage_input),
    token_usage_output: row.token_usage_output == null ? null : Number(row.token_usage_output),
    email_delivery_status: row.email_delivery_status ? String(row.email_delivery_status) : null,
    delivery_message_id: row.delivery_message_id ? String(row.delivery_message_id) : null,
    attempt_count: Number(row.attempt_count),
    can_retry: canRetry(row.status, row.updated_at),
  };
}

export async function claimQaRunForRetry(runId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT interview_id, status, failed_stage, updated_at, attempt_count
    FROM admin_qa_report_runs
    WHERE id = ${runId}
    LIMIT 1
  `;
  const run = rows[0] as {
    interview_id: string;
    status: string;
    failed_stage: QaFailedStage | null;
    updated_at: Date;
    attempt_count: number;
  } | undefined;
  if (!run) return { ok: false as const, status: 404, error: 'QA run not found' };
  const processingStatuses: QaFailedStage[] = ['AGGREGATING', 'EVALUATING', 'DELIVERING'];
  const staleStage = run.status === 'PERSISTED' && canRetry(run.status, run.updated_at)
    ? 'AGGREGATING'
    : processingStatuses.includes(run.status as QaFailedStage) && canRetry(run.status, run.updated_at)
      ? run.status as QaFailedStage
      : null;
  const startAt = run.status === 'FAILED' ? run.failed_stage : staleStage;
  if (!startAt) {
    return { ok: false as const, status: 409, error: 'Run is not failed or stale enough to retry' };
  }

  const attemptId = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - STALE_RUN_MS);
  const claimed = run.status === 'FAILED'
    ? await sql`
        UPDATE admin_qa_report_runs
        SET status = ${startAt}, failed_stage = NULL, error_message = NULL,
            processing_attempt_id = ${attemptId}, attempt_count = attempt_count + 1,
            completed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${runId} AND status = 'FAILED' AND failed_stage = ${startAt}
          AND attempt_count = ${run.attempt_count}
        RETURNING interview_id
      `
    : await sql`
        UPDATE admin_qa_report_runs
        SET processing_attempt_id = ${attemptId}, attempt_count = attempt_count + 1,
            error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${runId} AND status = ${run.status} AND updated_at < ${staleBefore}
          AND attempt_count = ${run.attempt_count}
        RETURNING interview_id
      `;
  if (!claimed.length) {
    return { ok: false as const, status: 409, error: 'Run was already claimed by another retry' };
  }

  return {
    ok: true as const,
    interviewId: run.interview_id,
    startAt,
    attemptId,
    staleRecovery: run.status !== 'FAILED',
  };
}

export async function retryQaRun(runId: string, actorUserId: string) {
  const sql = getSql();
  const claim = await claimQaRunForRetry(runId);
  if (!claim.ok) return claim;
  const { interviewId, startAt, attemptId, staleRecovery } = claim;

  await writeQaAudit(actorUserId, 'QA_REPORT_RETRIED', runId, 'SUCCESS', {
    resumed_at: startAt,
    stale_recovery: staleRecovery,
    attempt_id: attemptId,
  });
  let processing: ReportProcessingResult;
  try {
    processing = await processPostInterviewReport(interviewId, startAt, attemptId);
  } catch (error) {
    const message = sanitizeQaError(error);
    const failedStage = await getCurrentFailedStage(runId, startAt);
    await sql`
      UPDATE admin_qa_report_runs
      SET status = 'FAILED', failed_stage = ${failedStage}, error_message = ${message}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${runId} AND processing_attempt_id = ${attemptId}
    `;
    await writeQaAudit(actorUserId, 'QA_REPORT_FAILED', runId, 'FAILED', {
      retry: true,
      failed_stage: failedStage,
      error: message,
    });
    processing = {
      ok: false,
      interview_id: interviewId,
      stage: 'FAILED',
      failed_stage: failedStage,
      error: message,
    };
  }
  if (processing.ok) {
    await writeQaAudit(actorUserId, 'QA_REPORT_COMPLETED', runId, 'SUCCESS', {
      retry: true,
      message_id: processing.delivery?.message_id,
    });
  } else {
    await writeQaAudit(actorUserId, 'QA_REPORT_FAILED', runId, 'FAILED', {
      retry: true,
      failed_stage: processing.failed_stage,
      error: processing.error,
    });
  }
  return { ok: true as const, processing };
}

export async function getQaPageConfiguration() {
  const sql = getSql();
  const rows = await sql`
    SELECT key, value
    FROM system_settings
    WHERE key IN ('instruction_preface', 'report_delivery_email')
  `;
  const settings = Object.fromEntries(rows.map((row) => [String(row.key), String(row.value)]));
  return {
    instruction_preface: settings.instruction_preface ?? '',
    report_delivery_email: settings.report_delivery_email ?? '',
  };
}
