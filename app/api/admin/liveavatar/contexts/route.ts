import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * List LiveAvatar user contexts for dropdown (e.g. requisition form).
 * See: https://docs.liveavatar.com/reference/list_user_contexts_v1_contexts_get
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const apiKey = process.env.LIVEAVATAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'LIVEAVATAR_API_KEY not configured' }, { status: 503 });
  }
  try {
    const url = new URL('https://api.liveavatar.com/v1/contexts');
    url.searchParams.set('page_size', '100');
    const res = await fetch(url.toString(), {
      headers: { 'X-API-KEY': apiKey },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('LiveAvatar contexts error:', data);
      return NextResponse.json(
        { error: data?.message || data?.detail || 'Failed to list contexts' },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
    const results = data?.data?.results ?? data?.results ?? [];
    return NextResponse.json({ contexts: results });
  } catch (e) {
    console.error('LiveAvatar contexts error:', e);
    return NextResponse.json({ error: 'Failed to list contexts' }, { status: 500 });
  }
}
