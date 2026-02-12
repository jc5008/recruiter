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

/** Requires session.role === 'SUPER_ADMIN'. Use for user management and system settings. */
export async function requireSuperAdmin(request: NextRequest): Promise<{ session: SessionPayload } | NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
  }
  return auth;
}
