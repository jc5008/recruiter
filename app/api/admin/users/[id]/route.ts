import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin-auth';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OBSERVER', 'AUDITOR'];
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

/** Update user (role, name, status) — Super Admin only. */
export async function PATCH(
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
    const body = await request.json();
    const sql = getSql();

    const existing = await sql`
      SELECT first_name, last_name, role, status FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const cur = existing[0] as { first_name: string; last_name: string; role: string; status: string };

    const first_name = body.first_name !== undefined ? String(body.first_name).trim() : cur.first_name;
    const last_name = body.last_name !== undefined ? String(body.last_name).trim() : cur.last_name;
    const role = body.role !== undefined && VALID_ROLES.includes(body.role) ? body.role : cur.role;
    const status = body.status !== undefined && VALID_STATUSES.includes(body.status) ? body.status : cur.status;

    const updated = await sql`
      UPDATE users
      SET first_name = ${first_name}, last_name = ${last_name}, role = ${role}, status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, email, first_name, last_name, role, status, last_login_at, updated_at
    `;

    const { writeAuditLog } = await import('@/lib/audit');
    await writeAuditLog({
      actorUserId: auth.session.userId,
      eventType: 'USER_UPDATED',
      resourceTarget: userId,
      outcome: 'success',
      details: { first_name, last_name, role, status },
    });

    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error('User update error:', e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
