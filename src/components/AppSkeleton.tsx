'use client';

import { useState } from 'react';

import Sidebar from '@/components/sidebar/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false); // mobile toggle
  const [collapsed, setCollapsed] = useState(false); // desktop collapse

  return (
    <div className='flex'>
      {/* Sidebar */}
      <Sidebar
        open={open}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onClose={() => setOpen(false)}
      />

      {/* Main */}
      <div
        className={`flex min-h-screen w-full flex-col transition-all ${
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        {/* Top bar */}
        <header className='sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-white px-3'>
          <button
            onClick={() => setOpen(true)}
            className='rounded p-2 hover:bg-gray-100 lg:hidden'
            aria-label='Open menu'
            title='Open menu'
          >
            {/* hamburger */}
            <div className='h-0.5 w-5 bg-gray-800 mb-1' />
            <div className='h-0.5 w-5 bg-gray-800 mb-1' />
            <div className='h-0.5 w-5 bg-gray-800' />
          </button>
          <div className='text-sm text-gray-500'>Expense Tracker</div>
        </header>

        {/* Scrollable content */}
        <main className='h-[calc(100vh-3rem)] overflow-y-auto p-6'>
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          aria-label='Close menu overlay'
          className='fixed inset-0 z-30 bg-black/30 lg:hidden'
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
