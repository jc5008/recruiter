import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const TEST_CODE_PREFIX = 'DEV-';
const SEED_EMAIL = 'seed@wvsupply.local';

/**
 * Dev-only: create a test interview and return its access code.
 * Only available when NODE_ENV === 'development'.
 * POST /api/dev/create-test-interview
 */
export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const sql = getSql();

    let userId: string;
    const users = await sql`SELECT id FROM users WHERE email = ${SEED_EMAIL} LIMIT 1`;
    if (users.length > 0) {
      userId = (users[0] as { id: string }).id;
    } else {
      const inserted = await sql`
        INSERT INTO users (email, password_hash, first_name, last_name, role, status)
        VALUES (${SEED_EMAIL}, 'seed-placeholder', 'Seed', 'User', 'ADMIN', 'ACTIVE')
        RETURNING id
      `;
      userId = (inserted[0] as { id: string }).id;
    }

    let reqId: string;
    const reqs = await sql`SELECT id FROM requisitions LIMIT 1`;
    if (reqs.length > 0) {
      reqId = (reqs[0] as { id: string }).id;
    } else {
      const inserted = await sql`
        INSERT INTO requisitions (req_number, job_title, status, job_requirements, created_by)
        VALUES ('REQ-SEED-001', 'Test Role', 'ACTIVE', 'Test requirements.', ${userId})
        RETURNING id
      `;
      reqId = (inserted[0] as { id: string }).id;
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 5);
    const code = TEST_CODE_PREFIX + Date.now().toString(36).toUpperCase().slice(-6);

    const inserted = await sql`
      INSERT INTO interviews (
        candidate_first_name, candidate_last_name, candidate_email,
        requisition_id, access_code, deadline_at, status, registered_by
      )
      VALUES (
        'Dev', 'Candidate', 'dev@example.com',
        ${reqId}, ${code}, ${deadline.toISOString()}, 'REGISTERED', ${userId}
      )
      RETURNING id, access_code
    `;
    const row = inserted[0] as { id: string; access_code: string };

    return NextResponse.json({
      ok: true,
      accessCode: row.access_code,
      interviewId: row.id,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json(
        { error: 'Database not configured. Set sql_DATABASE_URL and run schema.' },
        { status: 503 }
      );
    }
    console.error('dev/create-test-interview:', err);
    return NextResponse.json({ error: 'Failed to create test interview' }, { status: 500 });
  }
}
