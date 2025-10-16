'use client';
import { useEffect, useState } from 'react';

interface Receipt {
  id: number;
  merchantText: string | null;
  date: string | null;
  storageUrl: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  status: string | null;
}

export default function InboxPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/receipts/fetchAllReceipts')
      .then((r) => r.json())
      .then((data) => setReceipts(data.items || []));
  }, []);

  const save = async (id: number, updates: Partial<Receipt>) => {
    setSaving(id);
    const res = await fetch(`/api/receipts/${id}/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const updated = await res.json();
    setReceipts((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setSaving(null);
  };

  return (
    <div className='p-6'>
      <h1 className='text-xl font-semibold mb-4'>📥 Receipt Inbox</h1>
      <table className='w-full border text-sm'>
        <thead className='bg-gray-100'>
          <tr>
            <th className='p-2 border'>Image</th>
            <th className='p-2 border'>ID</th>
            <th className='p-2 border'>Merchant</th>
            <th className='p-2 border'>Date</th>
            <th className='p-2 border'>Total (DKK)</th>
            <th className='p-2 border'>VAT (DKK)</th>
            <th className='p-2 border'>Status</th>
            <th className='p-2 border'>Action</th>
            <th className='p-2 border'>Delete</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id} className='odd:bg-white even:bg-gray-50'>
              {/* Thumbnail with link to full image */}
              <td className='p-2 border'>
                {r.storageUrl ? (
                  <a href={r.storageUrl} target='_blank' rel='noreferrer'>
                    <img
                      src={r.storageUrl}
                      alt={`Receipt ${r.id}`}
                      className='h-16 w-auto rounded border object-contain'
                    />
                  </a>
                ) : (
                  <span className='text-gray-400'>no image</span>
                )}
              </td>

              <td className='p-2 border'>{r.id}</td>
              <td className='p-2 border'>
                <input
                  className='border px-1'
                  value={r.merchantText ?? ''}
                  onChange={(e) =>
                    setReceipts((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? { ...x, merchantText: e.target.value }
                          : x
                      )
                    )
                  }
                />
              </td>
              <td className='p-2 border'>
                <input
                  type='date'
                  className='border px-1'
                  value={r.date ? r.date.split('T')[0] : ''}
                  onChange={(e) =>
                    setReceipts((prev) =>
                      prev.map((x) =>
                        x.id === r.id ? { ...x, date: e.target.value } : x
                      )
                    )
                  }
                />
              </td>
              <td className='p-2 border'>
                <input
                  type='number'
                  className='border px-1 w-24'
                  value={r.totalMinor ? r.totalMinor / 100 : ''}
                  onChange={(e) =>
                    setReceipts((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? { ...x, totalMinor: Number(e.target.value) * 100 }
                          : x
                      )
                    )
                  }
                />
              </td>
              <td className='p-2 border'>
                <input
                  type='number'
                  className='border px-1 w-24'
                  value={r.vatMinor ? r.vatMinor / 100 : ''}
                  onChange={(e) =>
                    setReceipts((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? { ...x, vatMinor: Number(e.target.value) * 100 }
                          : x
                      )
                    )
                  }
                />
              </td>
              <td className='p-2 border'>
                <select
                  className='border px-1'
                  value={r.status ?? ''}
                  onChange={(e) =>
                    setReceipts((prev) =>
                      prev.map((x) =>
                        x.id === r.id ? { ...x, status: e.target.value } : x
                      )
                    )
                  }
                >
                  <option value='uploaded'>uploaded</option>
                  <option value='parsed'>parsed</option>
                  <option value='reviewed'>reviewed</option>
                </select>
              </td>
              <td className='p-2 border'>
                <button
                  className='bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50'
                  onClick={() => save(r.id, r)}
                  disabled={saving === r.id}
                >
                  {saving === r.id ? 'Saving...' : 'Save'}
                </button>
              </td>

              <td className='p-2 border'>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this receipt?')) return;
                    await fetch(`/api/receipts/${r.id}/delete`, {
                      method: 'DELETE',
                    });
                    // then refresh list
                  }}
                  className='rounded border px-2 py-1 text-sm hover:bg-gray-50'
                >
                  🗑 Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
