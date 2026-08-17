import { aggregateInterviewData, buildAggregatedPrompt } from './aggregate-interview-data';
import { getSql } from './db';
import { runEvaluation, type EvaluationResult } from './openai-evaluation';
import { sendReport } from './report-delivery';
import { sanitizeQaError, type QaFailedStage, type QaRunStage } from './report-qa';

export type CompiledInterviewReport = {
  interview_id: string;
  candidate_name: string;
  transcript_segments: number;
  prompt_length: number;
};

export type ReportProcessingResult = {
  ok: boolean;
  interview_id: string;
  stage: QaRunStage;
  failed_stage?: QaFailedStage;
  error?: string;
  compiled?: CompiledInterviewReport;
  evaluation?: EvaluationResult;
  delivery?: { interview_id: string; message_id?: string };
};

async function setQaRunState(
  interviewId: string,
  status: QaRunStage,
  options: {
    failedStage?: QaFailedStage | null;
    error?: string | null;
    completed?: boolean;
    messageId?: string | null;
  } = {},
  attemptId?: string
) {
  const sql = getSql();
  const rows = await sql`
    UPDATE admin_qa_report_runs
    SET status = ${status},
        failed_stage = ${options.failedStage ?? null},
        error_message = ${options.error ?? null},
        delivery_message_id = COALESCE(${options.messageId ?? null}, delivery_message_id),
        processing_attempt_id = CASE
          WHEN ${status} IN ('COMPLETED', 'FAILED') THEN NULL
          ELSE processing_attempt_id
        END,
        completed_at = ${options.completed ? new Date() : null},
        updated_at = CURRENT_TIMESTAMP
    WHERE interview_id = ${interviewId}
      AND (${attemptId ?? null}::uuid IS NULL OR processing_attempt_id = ${attemptId ?? null})
    RETURNING id
  `;
  if (attemptId && !rows.length) {
    throw new Error('QA run processing lease was superseded by another attempt');
  }
}

async function getQaRunId(interviewId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM admin_qa_report_runs WHERE interview_id = ${interviewId} LIMIT 1
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function compileInterviewReport(interviewId: string): Promise<CompiledInterviewReport> {
  const data = await aggregateInterviewData(interviewId);
  const prompt = buildAggregatedPrompt(data);
  const sql = getSql();
  await sql`
    INSERT INTO interview_reports (
      interview_id,
      aggregated_prompt_text,
      instruction_preface_snapshot,
      email_delivery_status
    )
    VALUES (
      ${interviewId},
      ${prompt},
      ${data.system_instruction_preface},
      'PENDING'
    )
    ON CONFLICT (interview_id) DO UPDATE SET
      aggregated_prompt_text = ${prompt},
      instruction_preface_snapshot = ${data.system_instruction_preface},
      email_delivery_status = 'PENDING'
  `;

  return {
    interview_id: interviewId,
    candidate_name: `${data.interview.candidate_first_name} ${data.interview.candidate_last_name}`.trim(),
    transcript_segments: data.transcript.length,
    prompt_length: prompt.length,
  };
}

async function fail(
  interviewId: string,
  stage: QaFailedStage,
  error: unknown,
  partial: Omit<ReportProcessingResult, 'ok' | 'stage' | 'failed_stage' | 'error'>,
  attemptId?: string
): Promise<ReportProcessingResult> {
  const message = sanitizeQaError(error);
  try {
    await setQaRunState(interviewId, 'FAILED', { failedStage: stage, error: message }, attemptId);
  } catch {
    console.error('QA report failure state update failed');
  }
  return { ...partial, ok: false, stage: 'FAILED', failed_stage: stage, error: message };
}

/**
 * Executes the same post-interview stages for candidate and QA interviews.
 * startAt is used only for idempotent QA retries.
 */
export async function processPostInterviewReport(
  interviewId: string,
  startAt: QaFailedStage = 'AGGREGATING',
  attemptId?: string
): Promise<ReportProcessingResult> {
  const partial: Omit<ReportProcessingResult, 'ok' | 'stage' | 'failed_stage' | 'error'> = { interview_id: interviewId };

  if (startAt === 'AGGREGATING') {
    try {
      await setQaRunState(interviewId, 'AGGREGATING', {}, attemptId);
      partial.compiled = await compileInterviewReport(interviewId);
    } catch (error) {
      return fail(interviewId, 'AGGREGATING', error, partial, attemptId);
    }
  }

  if (startAt === 'AGGREGATING' || startAt === 'EVALUATING') {
    try {
      await setQaRunState(interviewId, 'EVALUATING', {}, attemptId);
      const evaluation = await runEvaluation(interviewId);
      if (!evaluation.ok) return fail(interviewId, 'EVALUATING', evaluation.error, partial, attemptId);
      partial.evaluation = evaluation;
    } catch (error) {
      return fail(interviewId, 'EVALUATING', error, partial, attemptId);
    }
  }

  try {
    await setQaRunState(interviewId, 'DELIVERING', {}, attemptId);
    const qaRunId = await getQaRunId(interviewId);
    const delivery = await sendReport(
      interviewId,
      qaRunId ? { idempotencyKey: `post-interview-qa/${qaRunId}` } : undefined
    );
    if (!delivery.ok) return fail(interviewId, 'DELIVERING', delivery.error, partial, attemptId);
    partial.delivery = delivery;
    await setQaRunState(interviewId, 'COMPLETED', {
      completed: true,
      messageId: delivery.message_id,
    }, attemptId);
  } catch (error) {
    return fail(interviewId, 'DELIVERING', error, partial, attemptId);
  }
  return { ...partial, ok: true, stage: 'COMPLETED' };
}
