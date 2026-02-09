import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

/** GET all active requisitions (for dropdowns). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, req_number, job_title
      FROM requisitions
      WHERE status = 'ACTIVE'
      ORDER BY job_title
    `;
    return NextResponse.json({ requisitions: rows });
  } catch (e) {
    console.error('Requisitions list error:', e);
    return NextResponse.json({ error: 'Failed to list requisitions' }, { status: 500 });
  }
}
