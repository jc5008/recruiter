import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin-auth';

/** Deactivate user (set status = DEACTIVATED) — Super Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 });
  }
  try {
    const sql = getSql();
    const updated = await sql`
      UPDATE users
      SET status = 'DEACTIVATED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, email, first_name, last_name, role, status
    `;
    if (updated.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { writeAuditLog } = await import('@/lib/audit');
    await writeAuditLog({
      actorUserId: auth.session.userId,
      eventType: 'USER_DEACTIVATED',
      resourceTarget: userId,
      outcome: 'success',
      details: { email: (updated[0] as { email: string }).email },
    });

    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error('User deactivate error:', e);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
