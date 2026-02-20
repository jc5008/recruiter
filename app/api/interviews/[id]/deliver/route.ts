import { NextResponse } from 'next/server';
import { sendReport } from '@/lib/report-delivery';

/**
 * Phase 6.3: Send post-interview report to configured email via Resend.
 * Requires report content (run evaluation 6.2 first) and report_delivery_email in Admin Settings.
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

    const result = await sendReport(interviewId);

    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      ok: true,
      interview_id: result.interview_id,
      message_id: result.message_id,
    });
  } catch (err) {
    console.error('interviews/[id]/deliver:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delivery failed' },
      { status: 500 }
    );
  }
}
