import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getActiveAdminSession } from '@/lib/admin-auth';
import ReportQaClient from './ReportQaClient';

export default async function ReportQaPage() {
  const session = await getActiveAdminSession((await headers()).get('cookie'));
  if (!session) redirect('/admin/login?from=/admin/report-qa');
  if (session.role !== 'SUPER_ADMIN') redirect('/admin');
  return <ReportQaClient />;
}
