import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { runEvaluation } from '@/lib/openai-evaluation';

/**
 * Developer tool: Run AI evaluation for an interview (Phase 6.2).
 * Super Admin only. Calls same logic as POST /api/interviews/[id]/evaluate.
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

    const result = await runEvaluation(interviewId);

    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      ok: true,
      interview_id: result.interview_id,
      model: result.model,
      finished_at: result.finished_at,
      token_usage_input: result.token_usage_input,
      token_usage_output: result.token_usage_output,
      report_length: result.report_markdown.length,
    });
  } catch (err) {
    console.error('developer/evaluate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation failed' },
      { status: 500 }
    );
  }
}
