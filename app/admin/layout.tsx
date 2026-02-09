import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';
import AdminNav from './AdminNav';

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');
  const session = await getSessionFromRequest(cookieHeader);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <header className="sticky top-0 z-40 border-b border-black/08 flex items-center justify-between px-4 py-3" style={{ background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold">Admin | WV Supply</Link>
          {session && <AdminNav />}
        </div>
        {session && (
          <div className="flex items-center gap-3">
            <span className="text-sm sub-text">{session.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm sub-text hover:opacity-80 underline">
                Log out
              </button>
            </form>
          </div>
        )}
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
