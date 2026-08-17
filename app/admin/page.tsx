import Link from 'next/link';
import { getActiveAdminSession } from '@/lib/admin-auth';
import { headers } from 'next/headers';

export default async function AdminDashboardPage() {
  const headersList = await headers();
  const session = await getActiveAdminSession(headersList.get('cookie')).catch(() => null);
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">Admin dashboard</h1>
      <p className="sub-text text-sm mb-6">Manage candidates, requisitions, and live sessions.</p>
      <ul className="space-y-3">
        <li>
          <Link href="/admin/candidates" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
            <span className="font-medium">Registered candidates</span>
            <span className="block text-sm sub-text mt-1">View candidates by name and job title; see registration details and interview codes.</span>
          </Link>
        </li>
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
              <Link href="/admin/report-qa" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
                <span className="font-medium">Post-Interview Report QA</span>
                <span className="block text-sm sub-text mt-1">Supply simulated report ingredients and run the real evaluation, PDF, and email pipeline. Super Admin only.</span>
              </Link>
            </li>
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
            <li>
              <Link href="/admin/developer" className="block p-4 rounded-lg border border-black/08 hover:bg-black/04 transition" style={{ background: 'var(--card-bg)' }}>
                <span className="font-medium">Developer tools</span>
                <span className="block text-sm sub-text mt-1">Compile aggregated reports for testing and debugging. Super Admin only.</span>
              </Link>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
