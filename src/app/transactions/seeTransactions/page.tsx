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
  receiptId?: number | null;
};

type Summary = {
  range: { from: string; to: string };
  count: number;
  totalOutMinor: number; // negative
  totalInMinor: number; // positive
  netMinor: number;
};

const fmtDkk = (minor?: number | null) =>
  minor != null ? (minor / 100).toFixed(2) + ' DKK' : '—';

function firstOfMonthISO(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}
function firstOfNextMonthISO(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}
function firstOfYearISO(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    .toISOString()
    .slice(0, 10);
}

export default function TransactionsPage() {
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(firstOfNextMonthISO());

  console.log('from', from);
  console.log('to', to);

  const [summary, setSummary] = useState<Summary | null>(null);

  console.log(summary);

  const [txs, setTxs] = useState<Tx[]>([]);

  console.log('txs', txs);

  const [loading, setLoading] = useState(true);

  const fetchAllTransactions = () => {
    fetch('/api/transactions/fetchAllTransactions')
      .then((r) => r.json())
      .then(setTxs);
  };

  const deleteAllTransactions = async () => {
    if (!confirm('Delete ALL transactions?')) return;

    await fetch('/api/transactions/deleteTransactions/allTransactions', {
      method: 'DELETE',
    });
    fetchAllTransactions();
  };

  async function load() {
    setLoading(true);
    const qs = `?from=${from}&to=${to}`;
    const [sumRes, listRes] = await Promise.all([
      fetch(`/api/transactions/summaryTransactions${qs}`).then((r) => r.json()),
      // fetch(`/api/transactions/fetch?from=${from}&to=${to}`)
      fetch(`/api/transactions/fetchAllTransactions`)
        .then((r) => r.json())
        .catch(() => []),
    ]);
    setSummary(sumRes);
    // if you don't have /api/transactions/fetch with date filter, fall back to /api/transactions and filter client-side:
    if (Array.isArray(listRes)) {
      setTxs(listRes);
    } else if (Array.isArray(listRes.items)) {
      setTxs(listRes.items);
    } else {
      const all = await fetch('/api/transactions/fetchAllTransactions').then(
        (r) => r.json()
      );
      setTxs(all);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [from, to]);

  return (
    <div className='p-0 space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>💳 Transactions</h1>

        <button
          onClick={deleteAllTransactions}
          className='rounded border px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer'
        >
          🗑 Delete all
        </button>
      </div>
      {/* Range controls + presets */}
      <div className='flex flex-wrap items-end gap-3 rounded-xl border p-3'>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-gray-600'>From</label>
          <input
            type='date'
            className='border rounded px-2 py-1'
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-gray-600'>To</label>
          <input
            type='date'
            className='border rounded px-2 py-1'
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className='flex gap-2'>
          <button
            className='rounded border px-2 py-1 text-sm hover:bg-gray-50'
            onClick={() => {
              setFrom(firstOfMonthISO());
              setTo(firstOfNextMonthISO());
            }}
          >
            This month
          </button>
          <button
            className='rounded border px-2 py-1 text-sm hover:bg-gray-50'
            onClick={() => {
              const d = new Date();
              d.setUTCMonth(d.getUTCMonth() - 1);
              setFrom(firstOfMonthISO(d));
              setTo(firstOfNextMonthISO(d));
            }}
          >
            Last month
          </button>
          <button
            className='rounded border px-2 py-1 text-sm hover:bg-gray-50'
            onClick={() => {
              setFrom(firstOfYearISO());
              setTo(firstOfNextMonthISO());
            }}
          >
            YTD
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>Spent</div>
          <div className='text-3xl font-semibold'>
            {summary ? fmtDkk(Math.abs(summary.totalOutMinor)) : '—'}
          </div>
        </div>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>Income</div>
          <div className='text-3xl font-semibold'>
            {summary ? fmtDkk(summary.totalInMinor) : '—'}
          </div>
        </div>
        <div className='rounded-xl border p-4'>
          <div className='text-gray-500 text-sm'>Net</div>
          <div className='text-3xl font-semibold'>
            {summary ? fmtDkk(summary.netMinor) : '—'}
          </div>
        </div>
      </div>

      {/* Table (client-side filter by date if needed) */}
      <div className='rounded-xl border overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-100 text-left'>
                <th className='p-2 border'>ID</th>
                <th className='p-2 border'>Date</th>
                <th className='p-2 border'>Amount</th>
                <th className='p-2 border'>Desc</th>
                <th className='p-2 border'>Merchant</th>
                <th className='p-2 border'>Status</th>
                <th className='p-2 border'>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? [] : txs)
                // .filter((t) => {
                //   if (!t.date) return false;
                //   const d = t.date.slice(0, 50);
                //   return d >= from && d < to; // simple string compare on ISO dates
                // })
                // .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                .map((t) => (
                  <tr key={t.id} className='odd:bg-white even:bg-gray-50'>
                    <td className='p-2 border'>{t.id}</td>
                    <td className='p-2 border'>
                      {t.date ? t.date.split('T')[0] : '—'}
                    </td>
                    <td className='p-2 border'>{fmtDkk(t.amountMinor)}</td>
                    <td className='p-2 border'>{t.rawDescription ?? '—'}</td>
                    <td className='p-2 border'>{t.merchantText ?? '—'}</td>
                    <td className='p-2 border'>{t.status ?? '—'}</td>
                    <td className='p-2 border'>
                      {t.receiptId
                        ? '✔'
                        : t.status === 'not_needed'
                        ? '✖'
                        : '—'}
                    </td>
                  </tr>
                ))}
              {!loading && txs.length === 0 && (
                <tr>
                  <td colSpan={7} className='p-4 text-center text-gray-500'>
                    No transactions in this range.
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

// 'use client';
// import { useEffect, useState } from 'react';

// type Tx = {
//   id: number;
//   date: string | null;
//   amountMinor: number | null;
//   currency: string | null;
//   rawDescription: string | null;
//   merchantText: string | null;
//   status: string | null;
//   receiptId: number | null;
// };

// export default function TransactionsPage() {
//   const [txs, setTxs] = useState<Tx[]>([]);

//   const fetchAllTransactions = () => {
//     fetch('/api/transactions/fetchAllTransactions')
//       .then((r) => r.json())
//       .then(setTxs);
//   };

//   const deleteAllTransactions = async () => {
//     if (!confirm('Delete ALL transactions?')) return;

//     await fetch('/api/transactions/deleteTransactions/allTransactions', {
//       method: 'DELETE',
//     });
//     fetchAllTransactions();
//   };

//   useEffect(() => {
//     fetchAllTransactions();
//   }, []);

//   return (
//     <div className='p-6 space-y-4'>
//       <div className='flex items-center justify-between'>
//         <h1 className='text-2xl font-semibold'>💳 Transactions</h1>

//         <button
//           onClick={deleteAllTransactions}
//           className='rounded border px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer'
//         >
//           🗑 Delete all
//         </button>
//       </div>
//       <div className='rounded-xl border overflow-hidden'>
//         <table className='w-full text-sm'>
//           <thead>
//             <tr className='bg-gray-100 text-left'>
//               <th className='p-2 border'>ID</th>
//               <th className='p-2 border'>Date</th>
//               <th className='p-2 border'>Amount</th>
//               <th className='p-2 border'>Desc</th>
//               <th className='p-2 border'>Merchant</th>
//               <th className='p-2 border'>Status</th>
//               <th className='p-2 border'>Receipt</th>
//               <th className='p-2 border'>Delete</th>
//             </tr>
//           </thead>
//           <tbody>
//             {txs.map((t) => {
//               return (
//                 <tr key={t.id} className='odd:bg-white even:bg-gray-50'>
//                   <td className='p-2 border'>{t.id}</td>
//                   <td className='p-2 border'>
//                     {t.date ? t.date.split('T')[0] : '—'}
//                   </td>
//                   <td className='p-2 border'>
//                     {t.amountMinor != null ? t.amountMinor / 100 : '—'}{' '}
//                     {t.currency ?? ''}
//                   </td>
//                   <td className='p-2 border'>{t.rawDescription ?? '—'}</td>
//                   <td className='p-2 border'>{t.merchantText ?? '—'}</td>
//                   <td className='p-2 border'>{t.status ?? '—'}</td>
//                   <td className='p-2 border'>
//                     {t.receiptId
//                       ? '✔' // linked
//                       : t.status === 'not_needed'
//                       ? '✖' // explicitly not needed
//                       : '—'}{' '}
//                   </td>{' '}
//                   <td className='p-2 border'>
//                     <button
//                       onClick={async () => {
//                         if (!confirm('Delete this transaction?')) return;
//                         await fetch(
//                           `/api/transactions/deleteTransactions/${t.id}`,
//                           {
//                             method: 'DELETE',
//                           }
//                         );
//                         fetch('/api/transactions/fetchAllTransactions')
//                           .then((r) => r.json())
//                           .then(setTxs);
//                       }}
//                       className='rounded border px-2 py-1 text-sm hover:bg-gray-50'
//                     >
//                       🗑 Delete
//                     </button>
//                   </td>
//                 </tr>
//               );
//             })}
//             {txs.length === 0 && (
//               <tr>
//                 <td colSpan={6} className='p-4 text-center text-gray-500'>
//                   No transactions yet.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }
