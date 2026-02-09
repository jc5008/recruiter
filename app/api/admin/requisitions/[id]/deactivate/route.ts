import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Requisition id required' }, { status: 400 });
  }
  try {
    const sql = getSql();
    const updated = await sql`
      UPDATE requisitions
      SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, req_number, job_title, status
    `;
    if (updated.length === 0) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error('Requisition deactivate error:', e);
    return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
  }
}
