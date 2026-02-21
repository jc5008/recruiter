import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

/** GET a single requisition by id (Admin). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const sql = getSql();
    const rows = await sql`
      SELECT r.id, r.req_number, r.job_title, r.status, r.job_requirements, r.qualifications, r.skills, r.liveavatar_context_id, r.job_analysis_instructions, r.created_at
      FROM requisitions r
      WHERE r.id = ${id}
      LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error('Requisition get error:', e);
    return NextResponse.json({ error: 'Failed to load requisition' }, { status: 500 });
  }
}

/** PUT update a requisition (Admin). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      req_number,
      job_title,
      status,
      job_requirements,
      qualifications,
      skills,
      liveavatar_context_id,
      job_analysis_instructions,
    } = body;

    if (!req_number || !job_title) {
      return NextResponse.json({ error: 'req_number and job_title required' }, { status: 400 });
    }

    const contextId =
      typeof liveavatar_context_id === 'string' && liveavatar_context_id.trim()
        ? liveavatar_context_id.trim()
        : null;
    const jobAnalysis =
      typeof job_analysis_instructions === 'string'
        ? (job_analysis_instructions.trim() || null)
        : null;
    const validStatus = ['ACTIVE', 'CLOSED', 'ON_HOLD', 'INACTIVE'].includes(status)
      ? status
      : 'ACTIVE';

    const sql = getSql();
    const updated = await sql`
      UPDATE requisitions
      SET
        req_number = ${String(req_number).trim()},
        job_title = ${String(job_title).trim()},
        status = ${validStatus},
        job_requirements = ${body.job_requirements ?? null},
        qualifications = ${body.qualifications ?? null},
        skills = ${body.skills ?? null},
        liveavatar_context_id = ${contextId},
        job_analysis_instructions = ${jobAnalysis},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, req_number, job_title, status, job_requirements, qualifications, skills, liveavatar_context_id, job_analysis_instructions, updated_at
    `;

    if (!updated.length) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error('Requisition update error:', e);
    return NextResponse.json({ error: 'Failed to update requisition' }, { status: 500 });
  }
}
