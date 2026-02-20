import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const SANDBOX_AVATAR_ID = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a'; // Wayne — https://docs.liveavatar.com/docs/developing-in-sandbox-mode

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEAVATAR_API_KEY;

  const sandboxMode = process.env.LIVEAVATAR_SANDBOX_MODE?.toUpperCase() === 'YES';
  const avatarId = sandboxMode ? SANDBOX_AVATAR_ID : (process.env.NEXT_PUBLIC_AVATAR_ID || SANDBOX_AVATAR_ID);
  const isSandbox = sandboxMode;

  let contextId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const interviewId = body?.interviewId;
    if (interviewId && typeof interviewId === 'string') {
      const sql = getSql();
      const rows = await sql`
        SELECT r.liveavatar_context_id
        FROM interviews i
        JOIN requisitions r ON r.id = i.requisition_id
        WHERE i.id = ${interviewId}
        LIMIT 1
      `;
      const r = rows[0] as { liveavatar_context_id: string | null } | undefined;
      if (r?.liveavatar_context_id) contextId = r.liveavatar_context_id;
    }
  } catch {
    // keep env fallback
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key in .env.local' }, { status: 500 });
  }

  try {
    const body: Record<string, unknown> = {
      mode: 'FULL',
      is_sandbox: isSandbox,
      avatar_id: avatarId,
    };
    if (contextId) {
      body.avatar_persona = { context_id: contextId };
    }
    const response = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("LiveAvatar API Error:", data);
      // Return the specific error message from LiveAvatar so the frontend sees it
      return NextResponse.json({ error: data.message || "API Error" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Token generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}