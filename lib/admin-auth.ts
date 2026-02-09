import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';

export async function requireAdmin(request: NextRequest): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSessionFromRequest(request.headers.get('cookie'));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { session };
}
