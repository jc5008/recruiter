import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { getSql } from '@/lib/db';
import { compileInterviewReport } from '@/lib/post-interview-report';

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

    const compiled = await compileInterviewReport(interviewId);

    return NextResponse.json({
      ok: true,
      interview_id: interviewId,
      candidate_name: compiled.candidate_name,
      transcript_segments: compiled.transcript_segments,
      prompt_length: compiled.prompt_length,
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
