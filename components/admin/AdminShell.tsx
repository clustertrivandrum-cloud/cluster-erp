'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/admin/Sidebar';
import Header from '@/components/admin/Header';

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isPOS = pathname === '/admin/pos';
  const isInvoiceRoute = /^\/admin\/orders\/[^/]+\/invoice$/.test(pathname);

  if (isInvoiceRoute) {
    return <div className="min-h-screen bg-gray-100">{children}</div>;
  }

  return (
    <div className={`bg-gray-50 ${isPOS ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex flex-col lg:pl-64 transition-all duration-300 ${isPOS ? 'h-full' : 'min-h-screen'}`}>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={`flex-1 ${isPOS ? 'overflow-hidden p-0 relative' : 'p-3 sm:p-4 lg:p-8'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
