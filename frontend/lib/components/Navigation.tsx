'use client';

/**
 * Main Navigation Component
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Clients', href: '/clients', icon: '👥' },
  { name: 'Campaigns', href: '/campaigns', icon: '📨' },
  { name: 'Templates', href: '/templates', icon: '📝' },
  { name: 'Messages', href: '/messages', icon: '💬' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="text-2xl">📱</span>
              <span>SMS Platform</span>
            </Link>
          </div>
          <div className="flex space-x-1">
            {navigation.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
              Mock Mode
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;