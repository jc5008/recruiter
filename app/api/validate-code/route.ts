import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { sendPushoverNotification } from '@/lib/pushover';

/** Reuse window: same code can be used again within this many ms of started_at, regardless of status (e.g. COMPLETED). */
const REUSE_WINDOW_MS = 31 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'Please enter your interview code.' },
        { status: 400 }
      );
    }

    const sql = getSql();
    // Case-insensitive match so Demo001, demo001, DEMO001 all work; join requisitions for job title
    const rows = await sql`
      SELECT i.id, i.candidate_first_name, i.candidate_last_name, i.deadline_at, i.status, i.started_at, r.job_title
      FROM interviews i
      LEFT JOIN requisitions r ON r.id = i.requisition_id
      WHERE i.access_code ILIKE ${code}
        AND NOT EXISTS (
          SELECT 1 FROM admin_qa_report_runs q WHERE q.interview_id = i.id
        )
      LIMIT 1
    `;

    const row = rows[0] as
      | { id: string; candidate_first_name: string; candidate_last_name: string; deadline_at: Date; status: string; started_at: Date | null; job_title: string | null }
      | undefined;

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'This code was not found. Please check it and try again.' },
        { status: 404 }
      );
    }

    const firstName = (row.candidate_first_name ?? '').trim();
    const lastName = (row.candidate_last_name ?? '').trim();
    const position = (row.job_title ?? 'Unknown position').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Candidate';

    const sendCodeEntryNotification = async (title: string, reason?: string) => {
      const message = reason ? `${fullName} — ${position} (${reason})` : `${fullName} — ${position}`;
      try {
        const sent = await sendPushoverNotification(message, { title });
        if (process.env.NODE_ENV !== 'test') {
          console.info(`validate-code: Pushover ${sent ? 'sent' : 'failed'} for interviewId=${row.id} code=${code}`);
        }
      } catch (err) {
        console.error('validate-code: Pushover notification failed:', err);
      }
    };

    const deadline = new Date(row.deadline_at);
    if (isNaN(deadline.getTime()) || deadline < new Date()) {
      await sendCodeEntryNotification('Code entry (expired)', 'deadline passed');
      return NextResponse.json(
        { ok: false, error: 'This code has expired.' },
        { status: 403 }
      );
    }

    // Reuse within 31-minute window of first start; allow regardless of status (COMPLETED, etc.). Outside window, session is expired.
    const startedAt = row.started_at ? new Date(row.started_at) : null;
    if (startedAt && !isNaN(startedAt.getTime())) {
      if (Date.now() - startedAt.getTime() > REUSE_WINDOW_MS) {
        await sendCodeEntryNotification('Code entry (session expired)', 'reuse window passed');
        return NextResponse.json(
          { ok: false, error: 'This session has expired. Please contact HR for a new code.' },
          { status: 403 }
        );
      }
    }

    // Accepted: notify and return success
    await sendCodeEntryNotification('Virtual Interview Started');

    return NextResponse.json({
      ok: true,
      interviewId: row.id,
      candidateFirstName: row.candidate_first_name ?? '',
      candidateLastName: row.candidate_last_name ?? '',
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
