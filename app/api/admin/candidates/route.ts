import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { generateUniqueAccessCode } from '@/lib/access-code';

type SortKey = 'first_name' | 'last_name' | 'created_at' | 'title';
const SORT_KEYS: SortKey[] = ['first_name', 'last_name', 'created_at', 'title'];

/** GET registered candidates with optional sort and job title filter. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const sort = (SORT_KEYS.includes(searchParams.get('sort') as SortKey) ? searchParams.get('sort') : 'created_at') as SortKey;
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const jobTitleFilter = searchParams.get('job_title')?.trim() || null;

    const sql = getSql();
    const rows = await sql`
      SELECT
        i.id,
        i.candidate_first_name,
        i.candidate_last_name,
        i.candidate_email,
        i.resume_text,
        i.requisition_id,
        i.access_code,
        i.deadline_at,
        i.status,
        i.created_at,
        r.job_title
      FROM interviews i
      LEFT JOIN requisitions r ON r.id = i.requisition_id
      WHERE ${jobTitleFilter ? sql`r.job_title = ${jobTitleFilter}` : sql`TRUE`}
    `;

    type Row = {
      id: string;
      candidate_first_name: string;
      candidate_last_name: string;
      candidate_email: string;
      resume_text: string | null;
      requisition_id: string | null;
      access_code: string;
      deadline_at: string;
      status: string;
      created_at: string;
      job_title: string | null;
    };
    const list = (rows as Row[]).slice();
    const cmp = (a: Row, b: Row): number => {
      let av: string | number = a.created_at;
      let bv: string | number = b.created_at;
      if (sort === 'first_name') {
        av = (a.candidate_first_name ?? '').toLowerCase();
        bv = (b.candidate_first_name ?? '').toLowerCase();
      } else if (sort === 'last_name') {
        av = (a.candidate_last_name ?? '').toLowerCase();
        bv = (b.candidate_last_name ?? '').toLowerCase();
      } else if (sort === 'title') {
        av = (a.job_title ?? '').toLowerCase();
        bv = (b.job_title ?? '').toLowerCase();
      }
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    };
    list.sort(cmp);

    const candidates = list.map((row) => ({
      id: row.id,
      candidate_first_name: row.candidate_first_name,
      candidate_last_name: row.candidate_last_name,
      candidate_email: row.candidate_email,
      resume_text: row.resume_text,
      requisition_id: row.requisition_id,
      access_code: row.access_code,
      deadline_at: row.deadline_at,
      status: row.status,
      created_at: row.created_at,
      job_title: row.job_title ?? null,
    }));

    return NextResponse.json({ candidates });
  } catch (e) {
    console.error('Candidates list error:', e);
    return NextResponse.json({ error: 'Failed to list candidates' }, { status: 500 });
  }
}

function parseDate(s: unknown): Date | null {
  if (typeof s !== 'string') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const {
      candidate_first_name,
      candidate_last_name,
      candidate_email,
      job_title,
      requisition_id,
      deadline_at,
      resume_text,
      registrant_name,
    } = body;

    if (!candidate_first_name?.trim() || !candidate_last_name?.trim() || !candidate_email?.trim()) {
      return NextResponse.json({ error: 'Candidate first name, last name, and email are required' }, { status: 400 });
    }
    const email = String(candidate_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    let deadline: Date;
    if (deadline_at) {
      const d = parseDate(deadline_at);
      if (!d) return NextResponse.json({ error: 'Invalid deadline date' }, { status: 400 });
      if (d <= new Date()) return NextResponse.json({ error: 'Deadline must be in the future' }, { status: 400 });
      deadline = d;
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      deadline = d;
    }

    if (!requisition_id) {
      return NextResponse.json({ error: 'Job / requisition is required' }, { status: 400 });
    }

    const sql = getSql();
    const code = await generateUniqueAccessCode(sql);

    const inserted = await sql`
      INSERT INTO interviews (
        candidate_first_name, candidate_last_name, candidate_email,
        resume_text, requisition_id, access_code, deadline_at, registered_by
      )
      VALUES (
        ${String(candidate_first_name).trim()},
        ${String(candidate_last_name).trim()},
        ${email},
        ${resume_text != null ? String(resume_text) : null},
        ${requisition_id},
        ${code},
        ${deadline.toISOString()},
        ${auth.session.userId}
      )
      RETURNING id, access_code, candidate_first_name, candidate_last_name, candidate_email, deadline_at
    `;
    const row = inserted[0] as { id: string; access_code: string; candidate_first_name: string; candidate_last_name: string; candidate_email: string; deadline_at: string };

    // Optional: send email to hr.automations@wvsupply.com (placeholder; wire to Resend/SendGrid when configured)
    const emailPayload = {
      to: 'hr.automations@wvsupply.com',
      subject: `New candidate registered: ${row.candidate_first_name} ${row.candidate_last_name}`,
      body: `Candidate: ${row.candidate_first_name} ${row.candidate_last_name}\nEmail: ${row.candidate_email}\nInterview code: ${row.access_code}\nDeadline: ${row.deadline_at}`,
    };
    if (process.env.EMAIL_ENABLED === 'true') {
      try {
        // TODO: integrate Resend/SendGrid when env is set
        console.log('Email (configure when ready):', emailPayload);
      } catch (e) {
        console.warn('Email send skipped:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      interview_id: row.id,
      access_code: row.access_code,
      candidate_first_name: row.candidate_first_name,
      candidate_last_name: row.candidate_last_name,
      candidate_email: row.candidate_email,
      deadline_at: row.deadline_at,
    });
  } catch (e) {
    console.error('Register candidate error:', e);
    return NextResponse.json({ error: 'Failed to register candidate' }, { status: 500 });
  }
}
