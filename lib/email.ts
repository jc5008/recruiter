/**
 * Send password reset email via Resend.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL in env.
 * Vercel Resend integration sets RESEND_API_KEY automatically.
 */
import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM_EMAIL || 'Virtual Interview <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return { ok: false, error: 'RESEND_API_KEY is not set. Add it to .env.local (get one at resend.com/api-keys).' };
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: 'Reset your password — Virtual Interview | WV Supply',
    html: `
      <p>You requested a password reset for your admin account.</p>
      <p><a href="${resetLink}" style="color: #2563eb;">Reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      <p>— Virtual Interview | WV Supply</p>
    `,
  });
  if (error) {
    console.error('Resend error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function buildResetLink(token: string): string {
  const base = APP_URL.replace(/\/$/, '');
  return `${base}/admin/reset-password?token=${encodeURIComponent(token)}`;
}
