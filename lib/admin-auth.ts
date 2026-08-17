import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';
import { getSql } from '@/lib/db';

export async function requireAdmin(request: NextRequest): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await getSessionFromRequest(request.headers.get('cookie'));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { session };
}

/**
 * Revalidates the signed session against the current database user record.
 * This prevents a deactivated or demoted user from retaining privileged access
 * until their otherwise-valid cookie expires.
 */
export async function getActiveAdminSession(cookieHeader: string | null): Promise<SessionPayload | null> {
  const session = await getSessionFromRequest(cookieHeader);
  if (!session) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT email, role
    FROM users
    WHERE id = ${session.userId} AND status = 'ACTIVE'
    LIMIT 1
  `;
  const user = rows[0] as { email: string; role: string } | undefined;
  if (!user) return null;
  return { ...session, email: user.email, role: user.role };
}

/** Requires the user's current database role to be SUPER_ADMIN. */
export async function requireSuperAdmin(request: NextRequest): Promise<{ session: SessionPayload } | NextResponse> {
  try {
    const session = await getActiveAdminSession(request.headers.get('cookie'));
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
    }
    return { session };
  } catch (error) {
    console.error('Super Admin authorization check failed');
    if (error instanceof Error && error.message.includes('sql_DATABASE_URL')) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Authorization service unavailable' }, { status: 503 });
  }
}
