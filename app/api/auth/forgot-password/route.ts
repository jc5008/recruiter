import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { sendPasswordResetEmail, buildResetLink } from '@/lib/email';
import crypto from 'crypto';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const sql = getSql();
    const users = await sql`
      SELECT id FROM users
      WHERE email = ${email} AND status = 'ACTIVE'
      LIMIT 1
    `;
    const user = users[0] as { id: string } | undefined;

    // Always return the same message so we don't leak whether the email exists
    const successMessage = 'If that email is registered, we sent a password reset link. Check your inbox.';

    if (!user) {
      return NextResponse.json({ message: successMessage });
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `;

    const resetLink = buildResetLink(token);
    const sendResult = await sendPasswordResetEmail(email, resetLink);

    if (!sendResult.ok) {
      // Remove token so they can try again
      await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send email. Check RESEND_API_KEY and RESEND_FROM_EMAIL.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ message: successMessage });
  } catch (e) {
    console.error('Forgot password error:', e);
    const message = e instanceof Error ? e.message : 'Something went wrong. Try again later.';
    // In development, surface DB/config errors (e.g. missing table, missing env)
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { error: isDev ? message : 'Something went wrong. Try again later.' },
      { status: 500 }
    );
  }
}
