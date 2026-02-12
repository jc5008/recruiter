import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin-auth';

/** List all admin users (Super Admin only). */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, first_name, last_name, role, status, last_login_at, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ users: rows });
  } catch (e) {
    console.error('Users list error:', e);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

/** Create a new admin user with a temporary password (Super Admin only). */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { first_name, last_name, email, role } = body;
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'OBSERVER', 'AUDITOR'];
    const roleVal = validRoles.includes(body.role) ? body.role : 'ADMIN';

    const bcrypt = await import('bcryptjs');
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const sql = getSql();
    const inserted = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status)
      VALUES (${emailNorm}, ${passwordHash}, ${String(first_name).trim()}, ${String(last_name).trim()}, ${roleVal}, 'ACTIVE')
      RETURNING id, email, first_name, last_name, role, status, created_at
    `;
    const user = inserted[0] as { id: string; email: string; first_name: string; last_name: string; role: string; status: string; created_at: string };

    const { writeAuditLog } = await import('@/lib/audit');
    await writeAuditLog({
      actorUserId: auth.session.userId,
      eventType: 'USER_CREATED',
      resourceTarget: user.id,
      outcome: 'success',
      details: { email: user.email, role: user.role },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, status: user.status, created_at: user.created_at },
      tempPassword,
    });
  } catch (e) {
    console.error('User create error:', e);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
