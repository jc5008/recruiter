import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { sendPushoverNotification } from '@/lib/pushover';

/**
 * Developer tool: Send a test Pushover notification to verify configuration.
 * Super Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const token = process.env.PUSHOVER_API_TOKEN;
  const user = process.env.PUSHOVER_GROUP_KEY ?? process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Pushover not configured. Set PUSHOVER_API_TOKEN and PUSHOVER_GROUP_KEY (or PUSHOVER_USER_KEY) in the environment.',
      },
      { status: 503 }
    );
  }

  const sent = await sendPushoverNotification('Test from Recruiter DC — if you see this, Pushover is working.', {
    title: 'Pushover test',
  });

  if (!sent) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Pushover API returned an error or request failed. Check server logs for details.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: 'Test notification sent. Check your Pushover device(s).' });
}
