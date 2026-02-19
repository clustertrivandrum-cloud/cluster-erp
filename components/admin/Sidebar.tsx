'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMyPermissions } from '@/lib/actions/user-actions';
import { LayoutDashboard, ShoppingBag, Users, Settings, Package, FileText, LogOut, X, Folder, Truck, ClipboardList, CreditCard } from 'lucide-react';

// Simple utility if @/lib/utils doesn't exist
function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

// Map menu items to required permissions
// If permission is null, it's visible to everyone (or basic auth)
const menuItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: 'view_dashboard' },
    { name: 'Products', href: '/admin/products', icon: Package, permission: 'manage_products' },
    { name: 'Categories', href: '/admin/categories', icon: Folder, permission: 'manage_products' },
    { name: 'Suppliers', href: '/admin/suppliers', icon: Truck, permission: 'manage_suppliers' },
    { name: 'Purchase Orders', href: '/admin/purchase-orders', icon: ClipboardList, permission: 'manage_suppliers' },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingBag, permission: 'manage_orders' },
    { name: 'Inventory', href: '/admin/inventory', icon: FileText, permission: 'manage_inventory' },
    { name: 'POS', href: '/admin/pos', icon: CreditCard, permission: 'access_pos' },
    { name: 'Customers', href: '/admin/customers', icon: Users, permission: 'manage_customers' },
    { name: 'Users', href: '/admin/users', icon: Users, permission: 'manage_users' },
    { name: 'Finance', href: '/admin/finance', icon: FileText, permission: 'manage_finance' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, permission: 'manage_settings' },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [permissions, setPermissions] = useState<string[] | null>(null);

    useEffect(() => {
        // Fetch permissions
        getMyPermissions().then(res => {
            if (res.success && res.data) {
                setPermissions(res.data);
            } else {
                // Fallback: If fetch fails (maybe network), empty or default? 
                // Let's assume empty means no access.
                setPermissions([]);
            }
        });
    }, []);

    // Filter items
    const filteredItems = menuItems.filter(item => {
        if (!permissions) return true; // Show all while loading? Or hide? 
        // Let's show all briefly or skeleton. showing all might expose links that error.
        // Better to wait or show nothing. 
        // Actually, for better UX, maybe we assume if permissions is null, we are loading.
        // But to avoid flashing restricted items, let's return false if permissions is not null.

        // Wait, if !permissions (null), we are loading. 
        // If we return true, everything shows.
        // If we return false, nothing shows.
        // Let's show nothing until loaded (safest).
        // BUT logic correction:
        if (permissions === null) return false;

        if (!item.permission) return true; // Public items
        return permissions.includes(item.permission);
    });

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={classNames(
                    "fixed inset-0 z-20 bg-black/50 transition-opacity lg:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar */}
            <aside
                className={classNames(
                    "fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-indigo-600">Cluster ERP</h1>
                    <button onClick={onClose} className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {permissions === null ? (
                        <div className="p-4 space-y-4 animate-pulse">
                            <div className="h-8 bg-gray-100 rounded"></div>
                            <div className="h-8 bg-gray-100 rounded"></div>
                            <div className="h-8 bg-gray-100 rounded"></div>
                        </div>
                    ) : (
                        filteredItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => onClose()} // Close on mobile navigation
                                    className={classNames(
                                        "flex items-center px-4 py-2 rounded-lg transition-colors group",
                                        isActive
                                            ? "bg-indigo-50 text-indigo-600"
                                            : "text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
                                    )}
                                >
                                    <Icon className={classNames("w-5 h-5 mr-3", isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600")} />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })
                    )}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <button className="flex items-center w-full px-4 py-2 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        <LogOut className="w-5 h-5 mr-3" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
