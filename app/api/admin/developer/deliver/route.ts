import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { sendReport } from '@/lib/report-delivery';

/**
 * Developer tool: Send report email for an interview (Phase 6.3).
 * Super Admin only. Calls same logic as POST /api/interviews/[id]/deliver.
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
    console.error('developer/deliver error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delivery failed' },
      { status: 500 }
    );
  }
}
