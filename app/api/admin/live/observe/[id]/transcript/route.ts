import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

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
    const sql = getSql();
    let rows: { id: string; speaker: string; content: string; timestamp_offset_ms: number | null; created_at: string }[];
    if (afterCreated) {
      rows = await sql`
        SELECT id, speaker, content, timestamp_offset_ms, created_at
        FROM transcript_segments
        WHERE interview_id = ${interviewId} AND created_at > ${afterCreated}
        ORDER BY created_at ASC
      `;
    } else {
      rows = await sql`
        SELECT id, speaker, content, timestamp_offset_ms, created_at
        FROM transcript_segments
        WHERE interview_id = ${interviewId}
        ORDER BY created_at ASC
      `;
    }
    return NextResponse.json({ segments: rows });
  } catch (e) {
    console.error('Transcript poll error:', e);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}
