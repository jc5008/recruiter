import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Poll transcript segments for an interview (for live observation). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: interviewId } = await params;
  if (!interviewId) {
    return NextResponse.json({ error: 'Interview id required' }, { status: 400 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const afterCreated = searchParams.get('after'); // optional: ISO created_at of last segment for incremental fetch
    const afterId = searchParams.get('after_id'); // optional: id of last segment (avoids duplicates when created_at ties)
    const sql = getSql();
    let rows: { id: string; speaker: string; content: string; timestamp_offset_ms: number | null; created_at: string }[];
    if (afterCreated) {
      if (afterId) {
        rows = await sql`
          SELECT id, speaker, content, timestamp_offset_ms, created_at
          FROM transcript_segments
          WHERE interview_id = ${interviewId}
            AND id != ${afterId}
            AND (created_at > ${afterCreated} OR (created_at = ${afterCreated} AND id > ${afterId}))
          ORDER BY created_at ASC, id ASC
        ` as typeof rows;
      } else {
        rows = await sql`
          SELECT id, speaker, content, timestamp_offset_ms, created_at
          FROM transcript_segments
          WHERE interview_id = ${interviewId} AND created_at > ${afterCreated}
          ORDER BY created_at ASC, id ASC
        ` as typeof rows;
      }
    } else {
      rows = await sql`
        SELECT id, speaker, content, timestamp_offset_ms, created_at
        FROM transcript_segments
        WHERE interview_id = ${interviewId}
        ORDER BY created_at ASC, id ASC
      ` as typeof rows;
    }
    const res = NextResponse.json({ segments: rows });
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    return res;
  } catch (e) {
    console.error('Transcript poll error:', e);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}
