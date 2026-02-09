import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSessionCookie, COOKIE_NAME, MAX_AGE_SEC } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 16) {
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_SESSION_SECRET is not set or too short. Add it to .env.local (at least 16 characters), then restart the dev server.' },
        { status: 503 }
      );
    }
    const body = await request.json();
    const { email, password } = body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, password_hash, first_name, last_name, role, status
      FROM users
      WHERE email = ${email.trim().toLowerCase()} AND status = 'ACTIVE'
      LIMIT 1
    `;
    const user = rows[0] as { id: string; email: string; password_hash: string; first_name: string; last_name: string; role: string; status: string } | undefined;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const signed = await createSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role } });
    res.cookies.set(COOKIE_NAME, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE_SEC,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('Login error:', e);
    const message = e instanceof Error ? e.message : 'Login failed';
    return NextResponse.json(
      { error: message.includes('ADMIN_SESSION_SECRET') ? 'Server configuration error: set ADMIN_SESSION_SECRET in .env.local (at least 16 characters).' : 'Login failed' },
      { status: 500 }
    );
  }
}
