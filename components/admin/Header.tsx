'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const pathname = usePathname();

    const title = useMemo(() => {
        if (pathname === '/admin') return 'Dashboard';
        if (pathname.startsWith('/admin/orders/')) return 'Orders';
        if (pathname.startsWith('/admin/purchase-orders/')) return 'Purchase Orders';

        const segment = pathname.split('/').filter(Boolean)[1] || 'dashboard';
        return segment
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }, [pathname]);

    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
            <div className="flex min-w-0 items-center">
                <button
                    onClick={onMenuClick}
                    aria-label="Open navigation"
                    className="mr-3 rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">Admin</p>
                    <h2 className="truncate text-lg font-semibold text-gray-800 sm:text-xl">{title}</h2>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 font-bold">
                    A
                </div>
            </div>
        </header>
    );
}
