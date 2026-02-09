import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

type SegmentBody = { speaker: 'USER' | 'AVATAR'; content: string; timestamp_offset_ms: number };

/**
 * Persist transcript segments for an interview (3.1).
 * POST body: { segments: Array<{ speaker: 'USER'|'AVATAR', content: string, timestamp_offset_ms: number }> }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    if (!interviewId) {
      return NextResponse.json({ error: 'Missing interview id' }, { status: 400 });
    }

    const body = await request.json();
    const segments = Array.isArray(body?.segments) ? body.segments as SegmentBody[] : [];
    if (segments.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const sql = getSql();
    for (const seg of segments) {
      const speaker = seg.speaker === 'USER' || seg.speaker === 'AVATAR' ? seg.speaker : 'USER';
      const content = typeof seg.content === 'string' ? seg.content : '';
      const ts = typeof seg.timestamp_offset_ms === 'number' ? seg.timestamp_offset_ms : null;
      await sql`
        INSERT INTO transcript_segments (interview_id, speaker, content, timestamp_offset_ms)
        VALUES (${interviewId}, ${speaker}, ${content}, ${ts})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    console.error('interviews/[id]/transcript:', err);
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
  }
}
