import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

/** Get interview metadata for observation view. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: interviewId } = await params;
  if (!interviewId) {
    return NextResponse.json({ error: 'Interview id required' }, { status: 400 });
  }
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT i.id, i.candidate_first_name, i.candidate_last_name, i.status, i.started_at, r.job_title
      FROM interviews i
      LEFT JOIN requisitions r ON r.id = i.requisition_id
      WHERE i.id = ${interviewId}
      LIMIT 1
    `;
    const r = rows[0] as { id: string; candidate_first_name: string; candidate_last_name: string; status: string; started_at: string | null; job_title: string | null } | undefined;
    if (!r) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: r.id,
      candidate_first_name: r.candidate_first_name,
      candidate_last_name: r.candidate_last_name,
      position_title: r.job_title || '—',
      status: r.status,
      started_at: r.started_at,
    });
  } catch (e) {
    console.error('Observation meta error:', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
