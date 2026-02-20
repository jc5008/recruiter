import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { aggregateInterviewData, buildAggregatedPrompt } from '@/lib/aggregate-interview-data';

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

    // Don't allow completing if already completed
    if (interview.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Interview already completed' }, { status: 400 });
    }

    // Calculate duration if started_at exists
    const now = new Date();
    const startedAt = interview.started_at ? new Date(interview.started_at) : null;
    const durationSeconds =
      startedAt && startedAt.getTime() <= now.getTime()
        ? Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        : null;

    // Update interview status
    await sql`
      UPDATE interviews
      SET 
        status = 'COMPLETED',
        ended_at = ${now},
        duration_seconds = ${durationSeconds}
      WHERE id = ${interviewId}
    `;

    // Aggregate all data for AI evaluation
    const aggregatedData = await aggregateInterviewData(interviewId);
    const aggregatedPrompt = buildAggregatedPrompt(aggregatedData);

    // Create or update interview_reports row with aggregated prompt
    await sql`
      INSERT INTO interview_reports (
        interview_id,
        aggregated_prompt_text,
        email_delivery_status
      )
      VALUES (
        ${interviewId},
        ${aggregatedPrompt},
        'PENDING'
      )
      ON CONFLICT (interview_id) DO UPDATE SET
        aggregated_prompt_text = ${aggregatedPrompt}
    `;

    return NextResponse.json({
      ok: true,
      interview_id: interviewId,
      status: 'COMPLETED',
      ended_at: now.toISOString(),
      duration_seconds: durationSeconds,
      transcript_segments: aggregatedData.transcript.length,
      has_aggregated_prompt: true,
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
