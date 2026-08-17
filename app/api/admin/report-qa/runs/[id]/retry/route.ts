import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { retryQaRun } from '@/lib/report-qa-runs';
import { sanitizeQaError } from '@/lib/report-qa';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const result = await retryQaRun(id, auth.session.userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: result.processing.ok ? 200 : 502 });
  } catch (error) {
    console.error('report-qa/runs/[id]/retry POST failed');
    return NextResponse.json({ error: sanitizeQaError(error) }, { status: 500 });
  }
}
