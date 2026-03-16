import Link from 'next/link';

export default function AdminNav({ role }: { role?: string }) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  return (
    <nav className="flex items-center gap-4">
      <Link href="/admin" className="text-sm sub-text hover:opacity-80">
        Dashboard
      </Link>
      <Link href="/admin/candidates" className="text-sm sub-text hover:opacity-80">
        Candidates
      </Link>
      <Link href="/admin/register" className="text-sm sub-text hover:opacity-80">
        Register candidate
      </Link>
      <Link href="/admin/requisitions" className="text-sm sub-text hover:opacity-80">
        Requisitions
      </Link>
      <Link href="/admin/live" className="text-sm sub-text hover:opacity-80">
        Live sessions
      </Link>
      {isSuperAdmin && (
        <>
          <Link href="/admin/users" className="text-sm sub-text hover:opacity-80">
            Users
          </Link>
          <Link href="/admin/settings" className="text-sm sub-text hover:opacity-80">
            Settings
          </Link>
        </>
      )}
    </nav>
  );
}
