import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`
      SELECT id FROM password_reset_tokens
      WHERE token = ${token} AND expires_at > NOW()
      LIMIT 1
    `;

    return NextResponse.json({ valid: rows.length > 0 });
  } catch (e) {
    console.error('Reset token validate error:', e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
