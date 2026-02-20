import { NextResponse } from 'next/server';
import { runEvaluation } from '@/lib/openai-evaluation';

/**
 * Phase 6.2: Run AI evaluation for an interview.
 * Loads aggregated prompt and instruction preface, calls OpenAI, stores report in interview_reports.
 * Can be called after 6.1 (compile aggregated report) or when candidate leaves (if we wire it).
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
    console.error('interviews/[id]/evaluate:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation failed' },
      { status: 500 }
    );
  }
}
