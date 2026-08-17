import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

/** GET distinct job titles (from requisitions) that have at least one registered candidate. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT DISTINCT r.job_title
      FROM requisitions r
      INNER JOIN interviews i ON i.requisition_id = r.id
      WHERE r.job_title IS NOT NULL AND r.job_title != ''
        AND NOT EXISTS (
          SELECT 1 FROM admin_qa_report_runs q WHERE q.interview_id = i.id
        )
      ORDER BY r.job_title
    `;
    const job_titles = (rows as { job_title: string }[]).map((r) => r.job_title);
    return NextResponse.json({ job_titles });
  } catch (e) {
    console.error('Job titles list error:', e);
    return NextResponse.json({ error: 'Failed to list job titles' }, { status: 500 });
  }
}
