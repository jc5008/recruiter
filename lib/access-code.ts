const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(length = 8): string {
  let code = '';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  for (let i = 0; i < length; i++) {
    code += CHARS[bytes[i]! % CHARS.length];
  }
  return code;
}

type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

/** Ensure code is unique in DB. */
export async function generateUniqueAccessCode(sql: SqlClient): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateAccessCode(8);
    const existing = await sql`SELECT access_code FROM interviews WHERE access_code = ${code} LIMIT 1`;
    if (Array.isArray(existing) && existing.length === 0) return code;
  }
  throw new Error('Could not generate unique access code');
}
