import AdminShell from '@/components/admin/AdminShell';
import { requireAuthenticatedAdmin } from '@/lib/auth';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireAuthenticatedAdmin();

    return (
        <AdminShell>{children}</AdminShell>
    )
}
