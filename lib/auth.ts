/**
 * Admin session: signed cookie helpers.
 * Uses Web Crypto so it works in Edge (middleware) and Node (API routes).
 * Requires ADMIN_SESSION_SECRET in env.
 */

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  if (typeof process !== 'undefined' && process.env) {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error('ADMIN_SESSION_SECRET must be set and at least 16 characters');
    }
    return secret;
  }
  return '';
}

function base64UrlEncode(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const bin = atob(padded);
  return new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
}

export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
  exp: number;
};

async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return key;
}

export async function createSessionCookie(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const data: SessionPayload = { ...payload, exp };
  const raw = JSON.stringify(data);
  const encoded = base64UrlEncode(new TextEncoder().encode(raw));
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return encoded + '.' + sigB64;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

export async function parseSessionCookie(value: string | undefined): Promise<SessionPayload | null> {
  if (!value || !value.includes('.')) return null;
  const [encoded, sigStr] = value.split('.');
  if (!encoded || !sigStr) return null;
  try {
    const key = await getKey();
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
    const expected = base64UrlEncode(new Uint8Array(sig));
    const expectedBytes = base64UrlDecode(expected);
    const actualBytes = base64UrlDecode(sigStr);
    if (!timingSafeEqual(actualBytes, expectedBytes)) return null;
    const raw = new TextDecoder().decode(base64UrlDecode(encoded));
    const data = JSON.parse(raw) as SessionPayload;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(cookieHeader: string | null): Promise<SessionPayload | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match ? decodeURIComponent(match[1].trim()) : undefined;
  return parseSessionCookie(value);
}

export { COOKIE_NAME, MAX_AGE_SEC };
