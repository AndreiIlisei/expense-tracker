'use client';
import { useEffect, useState } from 'react';

type Tx = {
  id: number;
  date: string | null;
  amountMinor: number | null;
  currency: string | null;
  rawDescription: string | null;
  merchantText: string | null;
  status: string | null;
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  useEffect(() => {
    fetch('/api/transactions/fetchAllTransactions')
      .then((r) => r.json())
      .then(setTxs);
  }, []);

  return (
    <div className='p-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>💳 Transactions</h1>
      <div className='rounded-xl border overflow-hidden'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-gray-100 text-left'>
              <th className='p-2 border'>ID</th>
              <th className='p-2 border'>Date</th>
              <th className='p-2 border'>Amount</th>
              <th className='p-2 border'>Desc</th>
              <th className='p-2 border'>Merchant</th>
              <th className='p-2 border'>Status</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} className='odd:bg-white even:bg-gray-50'>
                <td className='p-2 border'>{t.id}</td>
                <td className='p-2 border'>
                  {t.date ? t.date.split('T')[0] : '—'}
                </td>
                <td className='p-2 border'>
                  {t.amountMinor != null
                    ? (t.amountMinor / 100).toFixed(2)
                    : '—'}{' '}
                  {t.currency ?? ''}
                </td>
                <td className='p-2 border'>{t.rawDescription ?? '—'}</td>
                <td className='p-2 border'>{t.merchantText ?? '—'}</td>
                <td className='p-2 border'>{t.status ?? '—'}</td>
              </tr>
            ))}
            {txs.length === 0 && (
              <tr>
                <td colSpan={6} className='p-4 text-center text-gray-500'>
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
