import Link from 'next/link';
import { getSessionFromRequest } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function AdminDashboardPage() {
  const headersList = await headers();
  const session = await getSessionFromRequest(headersList.get('cookie'));
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">Admin dashboard</h1>
      <p className="sub-text text-sm mb-6">Manage candidates, requisitions, and live sessions.</p>
      <ul className="space-y-3">
        <li>
          <Link href="/admin/register" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
            <span className="font-medium">Register new candidate</span>
            <span className="block text-sm sub-text mt-1">Create an interview and get an access code.</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/requisitions" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
            <span className="font-medium">Job requisitions</span>
            <span className="block text-sm sub-text mt-1">Create and manage job postings; use in candidate registration.</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/live" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
            <span className="font-medium">View live sessions</span>
            <span className="block text-sm sub-text mt-1">Watch active interviews with TTS playback.</span>
          </Link>
        </li>
        {isSuperAdmin && (
          <>
            <li>
              <Link href="/admin/users" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
                <span className="font-medium">User management</span>
                <span className="block text-sm sub-text mt-1">List, add, edit, and deactivate admin users. Super Admin only.</span>
              </Link>
            </li>
            <li>
              <Link href="/admin/settings" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
                <span className="font-medium">System settings</span>
                <span className="block text-sm sub-text mt-1">Standard Instruction Preface for AI analysis. Super Admin only.</span>
              </Link>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
