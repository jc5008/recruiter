import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin-auth';

const KEY = 'instruction_preface';

/** Get Standard Instruction Preface (Super Admin only). */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT value FROM system_settings WHERE key = ${KEY} LIMIT 1
    `;
    const value = (rows[0] as { value: string } | undefined)?.value ?? '';
    return NextResponse.json({ value });
  } catch (e) {
    console.error('Instruction preface get error:', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

/** Save Standard Instruction Preface (Super Admin only). */
export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const value = typeof body.value === 'string' ? body.value : '';
    const sql = getSql();
    await sql`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES (${KEY}, ${value}, ${auth.session.userId}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = ${value},
        updated_by = ${auth.session.userId},
        updated_at = CURRENT_TIMESTAMP
    `;
    return NextResponse.json({ ok: true, value });
  } catch (e) {
    console.error('Instruction preface save error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
