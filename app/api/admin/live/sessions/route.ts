import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

/** List active (live) interviews for observation. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        i.id,
        i.candidate_first_name,
        i.candidate_last_name,
        i.status,
        i.started_at,
        r.job_title
      FROM interviews i
      LEFT JOIN requisitions r ON r.id = i.requisition_id
      WHERE i.status = 'ACTIVE' AND i.started_at IS NOT NULL
      ORDER BY i.started_at DESC
    `;
    return NextResponse.json({
      sessions: rows.map((r: { id: string; candidate_first_name: string; candidate_last_name: string; status: string; started_at: string | null; job_title: string | null }) => ({
        id: r.id,
        candidate_first_name: r.candidate_first_name,
        candidate_last_name: r.candidate_last_name,
        position_title: r.job_title || '—',
        session_status: r.status,
        started_at: r.started_at,
        observer_count: 0,
      })),
    });
  } catch (e) {
    console.error('Live sessions list error:', e);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
