import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const MODEL = 'gpt-4o-mini-tts';
const SPEED = 1.25;
const VOICE_AVATAR = 'shimmer'; // Interviewer
const VOICE_USER = 'marin';     // Candidate

/** Generate TTS audio via OpenAI. Admin only. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  let body: { text?: string; speaker?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const speaker = (body?.speaker === 'USER' || body?.speaker === 'AVATAR') ? body.speaker : 'AVATAR';

  if (!text) {
    return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
  }

  const voice = speaker === 'AVATAR' ? VOICE_AVATAR : VOICE_USER;

  try {
    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: text.slice(0, 4096),
        voice,
        speed: SPEED,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI TTS error:', res.status, errText);
      return NextResponse.json(
        { error: res.status === 401 ? 'OpenAI API key invalid' : 'TTS generation failed' },
        { status: res.status === 401 ? 502 : 502 }
      );
    }

    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('OpenAI TTS request failed:', err);
    return NextResponse.json({ error: 'TTS request failed' }, { status: 500 });
  }
}
