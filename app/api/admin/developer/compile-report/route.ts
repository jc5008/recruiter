import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { aggregateInterviewData, buildAggregatedPrompt } from '@/lib/aggregate-interview-data';
import { getSql } from '@/lib/db';

/**
 * Developer tool: Compile aggregated report for an interview.
 * Can be called multiple times to re-compile and overwrite existing aggregated prompt.
 * Super Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const interviewId = body?.interviewId;

    if (!interviewId || typeof interviewId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid interviewId' }, { status: 400 });
    }

    const sql = getSql();

    // Verify interview exists
    const interviewRows = await sql`
      SELECT id, candidate_first_name, candidate_last_name, status
      FROM interviews
      WHERE id = ${interviewId}
      LIMIT 1
    `;

    if (!interviewRows.length) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Aggregate all data for AI evaluation
    let aggregatedData;
    let aggregatedPrompt;
    try {
      aggregatedData = await aggregateInterviewData(interviewId);
      aggregatedPrompt = buildAggregatedPrompt(aggregatedData);
    } catch (aggErr) {
      console.error('Failed to aggregate interview data:', aggErr);
      return NextResponse.json(
        { error: `Failed to aggregate data: ${aggErr instanceof Error ? aggErr.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create or update interview_reports row with aggregated prompt
    try {
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
    } catch (insertErr) {
      console.error('Failed to insert/update interview_reports:', insertErr);
      // Check if column exists (migration might not have been run)
      if (insertErr instanceof Error && insertErr.message.includes('aggregated_prompt_text')) {
        return NextResponse.json(
          { error: 'Database migration required: Run migration 004 to add aggregated_prompt_text column' },
          { status: 500 }
        );
      }
      throw insertErr;
    }

    return NextResponse.json({
      ok: true,
      interview_id: interviewId,
      candidate_name: `${aggregatedData.interview.candidate_first_name} ${aggregatedData.interview.candidate_last_name}`,
      transcript_segments: aggregatedData.transcript.length,
      prompt_length: aggregatedPrompt.length,
      compiled_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('compile-report error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compile report' },
      { status: 500 }
    );
  }
}
