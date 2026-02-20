import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!token) {
      return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT prt.user_id
      FROM password_reset_tokens prt
      WHERE prt.token = ${token} AND prt.expires_at > NOW()
      LIMIT 1
    `;
    const row = rows[0] as { user_id: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${row.user_id}
    `;
    await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;

    return NextResponse.json({ message: 'Password updated. You can sign in with your new password.' });
  } catch (e) {
    console.error('Reset password error:', e);
    return NextResponse.json({ error: 'Something went wrong. Try again later.' }, { status: 500 });
  }
}
