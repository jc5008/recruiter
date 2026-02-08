import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.LIVEAVATAR_API_KEY;
  
  // OFFICIAL SANDBOX AVATAR ID (Wayne)
  // You cannot use custom avatars in Sandbox mode
  const avatarId = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"; 
  
  const contextId = process.env.NEXT_PUBLIC_CONTEXT_ID;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key in .env.local' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        is_sandbox: true, // Enable Sandbox
        avatar_id: avatarId,
        avatar_persona: {
          // If context_id causes issues in sandbox, try commenting this line out
          context_id: contextId, 
        },
      }),
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