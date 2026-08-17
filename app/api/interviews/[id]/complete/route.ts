import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import {
  processPostInterviewReport,
  type ReportProcessingResult,
} from '@/lib/post-interview-report';

/**
 * Phase 6.1: Mark interview as completed and aggregate data for AI evaluation.
 * 
 * When a candidate leaves the interview:
 * 1. Mark interview status as COMPLETED
 * 2. Set ended_at timestamp
 * 3. Calculate duration_seconds
 * 4. Aggregate all data (candidate, transcript, requisition, system instructions)
 * 5. Build and store aggregated prompt text
 * 6. Create interview_reports row (for Phase 6.2 processing)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    if (!interviewId) {
      return NextResponse.json({ error: 'Missing interview id' }, { status: 400 });
    }

    const sql = getSql();

    // First, check if interview exists and get started_at
    const interviewRows = await sql`
      SELECT id, started_at, ended_at, status
      FROM interviews
      WHERE id = ${interviewId}
      LIMIT 1
    `;

    if (!interviewRows.length) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const interview = interviewRows[0] as {
      id: string;
      started_at: Date | null;
      ended_at: Date | null;
      status: string;
    };

    // Calculate duration if started_at exists
    const now = new Date();
    const startedAt = interview.started_at ? new Date(interview.started_at) : null;
    const durationSeconds =
      startedAt && startedAt.getTime() <= now.getTime()
        ? Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        : null;

    // Update interview: set COMPLETED and latest ended_at/duration (allows reprocessing when code was reused within 31 min)
    await sql`
      UPDATE interviews
      SET 
        status = 'COMPLETED',
        ended_at = ${now},
        duration_seconds = ${durationSeconds}
      WHERE id = ${interviewId}
    `;

    // Aggregate, evaluate, generate PDF, and deliver through the shared report pipeline.
    // Candidate completion keeps its existing contract: downstream evaluation or
    // delivery failures are logged but do not make the completed interview fail.
    let reportResult: ReportProcessingResult | null = null;
    try {
      reportResult = await processPostInterviewReport(interviewId);
      if (!reportResult.ok && reportResult.failed_stage === 'AGGREGATING') {
        return NextResponse.json({ error: reportResult.error || 'Failed to aggregate report data' }, { status: 500 });
      }
      if (!reportResult.ok) {
        console.error(`Post-complete report pipeline failed at ${reportResult.failed_stage}`);
      }
    } catch {
      // Preserve the established candidate contract after the interview has been
      // marked complete, even for an unexpected downstream orchestration error.
      console.error('Post-complete report pipeline failed unexpectedly');
    }

    return NextResponse.json({
      ok: true,
      interview_id: interviewId,
      status: 'COMPLETED',
      ended_at: now.toISOString(),
      duration_seconds: durationSeconds,
      transcript_segments: reportResult?.compiled?.transcript_segments ?? 0,
      has_aggregated_prompt: Boolean(reportResult?.compiled),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }
    console.error('interviews/[id]/complete:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to complete interview' },
      { status: 500 }
    );
  }
}
