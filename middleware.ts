import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }
  try {
    const session = await getSessionFromRequest(request.headers.get('cookie'));
    if (!session) {
      const login = new URL('/admin/login', request.url);
      login.searchParams.set('from', pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  } catch {
    const login = new URL('/admin/login', request.url);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
