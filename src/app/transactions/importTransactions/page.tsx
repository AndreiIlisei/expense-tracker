/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState } from 'react';

export default function ImportTransactionsPage() {
  const [res, setRes] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>
        📥 Import Transactions (Bank Norwegian)
      </h1>
      <form
        className='space-y-3 rounded-xl border p-4'
        onSubmit={async (e) => {
          e.preventDefault();
          setRes(null);
          setError(null);
          const fileInput = e.currentTarget.elements.namedItem(
            'file'
          ) as HTMLInputElement;
          if (!fileInput.files?.[0]) return;
          const fd = new FormData();
          fd.append('file', fileInput.files[0]);
          setPending(true);
          try {
            const r = await fetch('/api/transactions/importTransactions', {
              method: 'POST',
              body: fd,
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || 'Import failed');
            setRes(j);
          } catch (err: string | Error | unknown | any) {
            setError(err?.message || 'Import failed');
          } finally {
            setPending(false);
            fileInput.value = '';
          }
        }}
      >
        <input
          name='file'
          type='file'
          accept='.csv,text/csv,xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        />
        <div className='flex items-center gap-2'>
          <button
            type='submit'
            disabled={pending}
            className='rounded bg-black text-white px-4 py-2 disabled:opacity-50'
          >
            {pending ? 'Importing...' : 'Import CSV'}
          </button>
          <a href='/transactions/seeTransactions' className='text-sm underline'>
            View transactions
          </a>
        </div>
        {error && <div className='text-sm text-red-600'>{error}</div>}
      </form>
      <pre className='bg-gray-100 p-3 rounded text-sm overflow-auto'>
        {res ? JSON.stringify(res, null, 2) : 'No result yet'}
      </pre>
    </div>
  );
}
