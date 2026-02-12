import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const sql = getSql();
    const rows = await sql`
      SELECT r.id, r.req_number, r.job_title, r.status, r.job_requirements, r.created_at
      FROM requisitions r
      WHERE r.status = ${status}
      ORDER BY r.created_at DESC
    `;
    return NextResponse.json({ requisitions: rows });
  } catch (e) {
    console.error('Requisitions list error:', e);
    return NextResponse.json({ error: 'Failed to list requisitions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { req_number, job_title, job_requirements } = body;
    if (!req_number || !job_title) {
      return NextResponse.json({ error: 'req_number and job_title required' }, { status: 400 });
    }
    const sql = getSql();
    const inserted = await sql`
      INSERT INTO requisitions (req_number, job_title, status, job_requirements, created_by)
      VALUES (${String(req_number).trim()}, ${String(job_title).trim()}, 'ACTIVE', ${body.job_requirements ?? null}, ${auth.session.userId})
      RETURNING id, req_number, job_title, status, created_at
    `;
    return NextResponse.json(inserted[0]);
  } catch (e) {
    console.error('Requisition create error:', e);
    return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 });
  }
}
