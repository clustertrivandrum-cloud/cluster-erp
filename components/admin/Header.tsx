'use client';

import { Menu } from 'lucide-react';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="sticky top-0 z-10 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center">
                <button
                    onClick={onMenuClick}
                    className="p-2 mr-4 text-gray-600 hover:bg-gray-100 rounded-md lg:hidden"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
            </div>

            <div className="flex items-center space-x-4">
                {/* Placeholder for user profile or notifications */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    A
                </div>
            </div>
        </header>
    );
}
