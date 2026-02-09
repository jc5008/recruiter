import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

/**
 * Mark the interview session as started (set started_at).
 * Only updates if started_at is not already set (first start).
 * Used for 30-minute reuse window (2.3).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    if (!interviewId) {
      return NextResponse.json({ error: 'Missing interview id' }, { status: 400 });
    }

    const sql = getSql();
    await sql`
      UPDATE interviews
      SET started_at = NOW()
      WHERE id = ${interviewId}
        AND started_at IS NULL
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }
    console.error('interviews/[id]/start:', err);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
