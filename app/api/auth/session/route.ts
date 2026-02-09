import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getSql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request.headers.get('cookie'));
    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, first_name, last_name, role, status
      FROM users
      WHERE id = ${session.userId} AND status = 'ACTIVE'
      LIMIT 1
    `;
    const user = rows[0] as { id: string; email: string; first_name: string; last_name: string; role: string; status: string } | undefined;
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
