import { NextResponse } from 'next/server';

/**
 * Returns session token AND calls start so the response includes
 * livekit_url and livekit_client_token for the LiveKit connection tester
 * and meet URL (see https://docs.liveavatar.com/docs/quick-start-guide step 3).
 */
export async function POST() {
  const apiKey = process.env.LIVEAVATAR_API_KEY;
  const avatarId = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';
  const contextId = process.env.NEXT_PUBLIC_CONTEXT_ID;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key in .env.local' }, { status: 500 });
  }

  try {
    const tokenRes = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        is_sandbox: true,
        avatar_id: avatarId,
        avatar_persona: contextId ? { context_id: contextId } : {},
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('LiveAvatar token error:', tokenData);
      return NextResponse.json(
        { error: tokenData.message || 'Token API Error' },
        { status: tokenRes.status }
      );
    }

    const sessionToken =
      (tokenData.data && tokenData.data.session_token) || tokenData.session_token;
    if (!sessionToken) {
      return NextResponse.json({ error: 'No session_token in token response' }, { status: 500 });
    }

    const startRes = await fetch('https://api.liveavatar.com/v1/sessions/start', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const startData = await startRes.json();
    if (!startRes.ok) {
      console.error('LiveAvatar start error:', startData);
      return NextResponse.json(
        { error: startData.message || 'Start API Error' },
        { status: startRes.status }
      );
    }

    const livekitUrl =
      (startData.data && startData.data.livekit_url) || startData.livekit_url;
    const livekitClientToken =
      (startData.data && startData.data.livekit_client_token) ||
      startData.livekit_client_token;

    return NextResponse.json({
      session_id: tokenData.session_id ?? tokenData.data?.session_id,
      session_token: sessionToken,
      livekit_url: livekitUrl,
      livekit_client_token: livekitClientToken,
    });
  } catch (error: unknown) {
    console.error('Start session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
