'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inbox', label: 'Receipts' },
  { href: '/uploadReceipts', label: 'Upload Receipts' },
  { href: '/transactions/seeTransactions', label: 'See Transactions' },
  { href: '/transactions/importTransactions', label: 'Import Transactions' },
  { href: '/projectInfo', label: 'Project Info' },
];

export default function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 h-screen border-r bg-white p-3 flex flex-col transition-all',
        collapsed ? 'w-16' : 'w-60',
        // desktop vs mobile
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* header */}
      <div
        className={clsx(
          'mb-6 flex items-center',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && <h1 className='text-lg font-semibold'>💰 Expense</h1>}
        <button
          onClick={collapsed ? onToggleCollapse : onToggleCollapse}
          className='rounded p-1 hover:bg-gray-100 hidden lg:block'
          aria-label='Toggle collapse'
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
        <button
          onClick={onClose}
          className='rounded p-1 hover:bg-gray-100 lg:hidden'
          aria-label='Close menu'
        >
          ✕
        </button>
      </div>

      {/* nav */}
      <nav className='space-y-1 flex-1'>
        {!collapsed &&
          links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className={clsx(
                'flex items-center gap-2 rounded px-2 py-2 text-sm transition-colors',
                pathname === l.href
                  ? 'bg-gray-100 font-semibold text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              {/* <span>{l.icon}</span> */}
              {!collapsed && <span>{l.label}</span>}
            </Link>
          ))}
      </nav>

      {!collapsed && (
        <footer className='mt-auto text-xs text-gray-400'>v0.1 • Andrei</footer>
      )}
    </aside>
  );
}
