import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const VALID_STATUSES = ['REGISTERED', 'ACTIVE'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'Please enter your interview code.' },
        { status: 400 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT id, candidate_first_name, deadline_at, status, started_at
      FROM interviews
      WHERE access_code = ${code}
      LIMIT 1
    `;

    const row = rows[0] as
      | { id: string; candidate_first_name: string; deadline_at: Date; status: string; started_at: Date | null }
      | undefined;

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'This code was not found. Please check it and try again.' },
        { status: 404 }
      );
    }

    if (!VALID_STATUSES.includes(row.status)) {
      return NextResponse.json(
        { ok: false, error: 'This interview is no longer available.' },
        { status: 403 }
      );
    }

    const deadline = new Date(row.deadline_at);
    if (isNaN(deadline.getTime()) || deadline < new Date()) {
      return NextResponse.json(
        { ok: false, error: 'This code has expired.' },
        { status: 403 }
      );
    }

    // Reuse within 30-minute window of first start (2.3)
    const startedAt = row.started_at ? new Date(row.started_at) : null;
    if (startedAt && !isNaN(startedAt.getTime())) {
      const thirtyMinMs = 30 * 60 * 1000;
      if (Date.now() - startedAt.getTime() > thirtyMinMs) {
        return NextResponse.json(
          { ok: false, error: 'This session has expired. Please contact HR for a new code.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      interviewId: row.id,
      candidateFirstName: row.candidate_first_name ?? '',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json(
        { ok: false, error: 'Service is not configured for codes. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('validate-code:', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
