'use client';
import { useEffect, useMemo, useState } from 'react';

type Receipt = {
  id: number;
  storageUrl: string | null;
  merchantText: string | null;
  date: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  status: string | null;
};

type Summary = { count: number; totalMinor: number; vatMinor: number };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/receipts/summary').then((r) => r.json()),
      fetch('/api/receipts/fetchAllReceipts').then((r) => r.json()),
    ]).then(([sum, list]) => {
      setSummary(sum);
      setReceipts(list.items ?? list);
      setLoading(false);
    });
  }, []);

  const totalDkk = useMemo(
    () => (summary ? (summary.totalMinor / 100).toFixed(2) : '0.00'),
    [summary]
  );
  const vatDkk = useMemo(
    () => (summary ? (summary.vatMinor / 100).toFixed(2) : '0.00'),
    [summary]
  );

  // if (!loading) return null;

  return (
    <div className='p-6 space-y-6'>
      <h1 className='text-2xl font-semibold'>📊 Dashboard</h1>

      {/* KPIs */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>Receipts</div>
          <div className='text-3xl font-semibold'>{summary?.count ?? 0}</div>
        </div>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>Total (DKK)</div>
          <div className='text-3xl font-semibold'>{totalDkk}</div>
        </div>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>VAT (DKK)</div>
          <div className='text-3xl font-semibold'>{vatDkk}</div>
        </div>
      </div>

      {/* List */}
      <div className='rounded-xl border overflow-hidden'>
        <div className='bg-gray-50 px-4 py-2 font-medium'>Recent Receipts</div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left bg-gray-100'>
                <th className='p-2 border'>ID</th>
                <th className='p-2 border'>Image</th>
                <th className='p-2 border'>Merchant</th>
                <th className='p-2 border'>Date</th>
                <th className='p-2 border'>Total (DKK)</th>
                <th className='p-2 border'>VAT (DKK)</th>
                <th className='p-2 border'>Status</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : receipts)
                .slice()
                .reverse()
                .map((r) => (
                  <tr
                    key={r.id}
                    className='odd:bg-white even:bg-gray-50 align-top'
                  >
                    <td className='p-2 border'>{r.id}</td>
                    <td className='p-2 border'>
                      {r.storageUrl ? (
                        <a href={r.storageUrl} target='_blank' rel='noreferrer'>
                          <img
                            src={r.storageUrl}
                            alt={`Receipt ${r.id}`}
                            className='h-14 w-auto rounded border object-contain'
                          />
                        </a>
                      ) : (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                    <td className='p-2 border'>
                      {r.merchantText ?? (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                    <td className='p-2 border'>
                      {r.date ? (
                        r.date.split('T')[0]
                      ) : (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                    <td className='p-2 border'>
                      {r.totalMinor != null
                        ? (r.totalMinor / 100).toFixed(2)
                        : '—'}
                    </td>
                    <td className='p-2 border'>
                      {r.vatMinor != null ? (r.vatMinor / 100).toFixed(2) : '—'}
                    </td>
                    <td className='p-2 border'>{r.status ?? '—'}</td>
                  </tr>
                ))}
              {!loading && receipts.length === 0 && (
                <tr>
                  <td colSpan={7} className='p-4 text-center text-gray-500'>
                    No receipts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
