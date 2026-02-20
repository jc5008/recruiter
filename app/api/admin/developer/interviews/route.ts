import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { getSql } from '@/lib/db';

/**
 * Developer tool: List all interviews for dropdown selection.
 * Super Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 
        id,
        candidate_first_name,
        candidate_last_name,
        candidate_email,
        status,
        started_at,
        ended_at,
        created_at
      FROM interviews
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const interviews = rows.map((r) => ({
      id: r.id,
      candidate_name: `${r.candidate_first_name} ${r.candidate_last_name}`,
      candidate_email: r.candidate_email,
      status: r.status,
      started_at: r.started_at ? new Date(r.started_at).toISOString() : null,
      ended_at: r.ended_at ? new Date(r.ended_at).toISOString() : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));

    return NextResponse.json({ interviews });
  } catch (err) {
    console.error('list-interviews error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list interviews' },
      { status: 500 }
    );
  }
}
