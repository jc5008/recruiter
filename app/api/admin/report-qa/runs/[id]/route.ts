import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { getQaRun } from '@/lib/report-qa-runs';
import { sanitizeQaError } from '@/lib/report-qa';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const run = await getQaRun(id);
    if (!run) return NextResponse.json({ error: 'QA run not found' }, { status: 404 });
    return NextResponse.json({ run }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('report-qa/runs/[id] GET failed');
    return NextResponse.json({ error: sanitizeQaError(error) }, { status: 500 });
  }
}
