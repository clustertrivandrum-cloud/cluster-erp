'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/admin/Sidebar';
import Header from '@/components/admin/Header';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const pathname = usePathname();
    const isPOS = pathname === '/admin/pos';

    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-col lg:pl-64 min-h-screen transition-all duration-300">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className={`flex-1 ${isPOS ? 'p-0 h-[calc(100dvh-4rem)] overflow-hidden' : 'p-4 lg:p-8'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
}
