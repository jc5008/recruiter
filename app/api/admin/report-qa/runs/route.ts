import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { createAndProcessQaRun, getQaPageConfiguration, listQaRuns } from '@/lib/report-qa-runs';
import { sanitizeQaError, validateQaReportPayload } from '@/lib/report-qa';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_REQUEST_BYTES = 2_000_000;

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit') || 25);
    const [runs, configuration] = await Promise.all([
      listQaRuns(Number.isFinite(requestedLimit) ? requestedLimit : 25),
      getQaPageConfiguration(),
    ]);
    return NextResponse.json({ runs, configuration }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('report-qa/runs GET failed');
    return NextResponse.json({ error: sanitizeQaError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'QA input exceeds the 2 MB request limit' }, { status: 413 });
  }

  try {
    const body = await request.json();
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'QA input exceeds the 2 MB request limit' }, { status: 413 });
    }
    const validation = validateQaReportPayload(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const result = await createAndProcessQaRun(validation.value, auth.session.userId);
    return NextResponse.json(result, { status: result.processing.ok ? 201 : 502 });
  } catch (error) {
    console.error('report-qa/runs POST failed');
    return NextResponse.json({ error: sanitizeQaError(error) }, { status: 500 });
  }
}
