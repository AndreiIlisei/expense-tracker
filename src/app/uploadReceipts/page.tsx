'use client';
import { useEffect, useState } from 'react';

type Receipt = {
  id: number;
  storageUrl: string | null;
  merchantText: string | null;
  date: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  status: string | null;
};

export default function UploadPage() {
  const [autoOcr, setAutoOcr] = useState(true);
  const [pending, setPending] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const [runningOcrId, setRunningOcrId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshRecent() {
    const r = await fetch('/api/receipts/fetchAllReceipts?limit=10');
    const j = await r.json();
    setRecent(j.items ?? j); // supports both structures
  }

  useEffect(() => {
    refreshRecent();
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const input = e.currentTarget.elements.namedItem(
      'file'
    ) as HTMLInputElement;
    if (!input.files?.[0]) return;
    const fd = new FormData();
    fd.append('file', input.files[0]);

    setPending(true);
    try {
      const r = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Upload failed');
      const receipt = j.receipt as Receipt;
      setLastReceipt(receipt);
      await refreshRecent();

      if (autoOcr && receipt?.id) {
        setRunningOcrId(receipt.id);
        const o = await fetch(`/api/receipts/${receipt.id}/extraction`, {
          method: 'POST',
        });
        if (!o.ok) {
          const err = await o.json().catch(() => ({}));
          throw new Error(err?.error || 'OCR failed');
        }
        setRunningOcrId(null);
        await refreshRecent();
      }
      // clear file input
      input.value = '';
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
      setRunningOcrId(null);
    } finally {
      setPending(false);
    }
  }

  async function runOcr(id: number) {
    setRunningOcrId(id);
    setError(null);
    try {
      const r = await fetch(`/api/receipts/${id}/extraction`, {
        method: 'POST',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'OCR failed');
      await refreshRecent();
    } catch (e: any) {
      setError(e?.message || 'OCR failed');
    } finally {
      setRunningOcrId(null);
    }
  }

  return (
    <div className='p-6 space-y-6'>
      <h1 className='text-2xl font-semibold'>⬆️ Upload Receipts</h1>

      <form onSubmit={handleUpload} className='space-y-3 rounded-xl border p-4'>
        <div className='flex items-center gap-3'>
          <input
            name='file'
            type='file'
            accept='image/*,.pdf'
            className='block'
          />
          <button
            type='submit'
            disabled={pending}
            className='rounded bg-black text-white px-4 py-2 disabled:opacity-50'
          >
            {pending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={autoOcr}
            onChange={(e) => setAutoOcr(e.target.checked)}
          />
          Auto-run OCR after upload
        </label>
        {error && <div className='text-sm text-red-600'>{error}</div>}
        {lastReceipt && (
          <div className='text-sm text-gray-600'>
            Last upload: receipt #{lastReceipt.id}{' '}
            {runningOcrId === lastReceipt.id && '— running OCR...'}
          </div>
        )}
      </form>

      <section className='space-y-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Recent uploads</h2>
          <button
            onClick={refreshRecent}
            className='text-sm rounded border px-3 py-1 hover:bg-gray-50'
          >
            Refresh
          </button>
        </div>

        <div className='rounded-xl border overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-100 text-left'>
                  <th className='p-2 border'>ID</th>
                  <th className='p-2 border'>Image</th>
                  <th className='p-2 border'>Merchant</th>
                  <th className='p-2 border'>Date</th>
                  <th className='p-2 border'>Total (DKK)</th>
                  <th className='p-2 border'>VAT (DKK)</th>
                  <th className='p-2 border'>Status</th>
                  <th className='p-2 border'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
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
                    <td className='p-2 border'>{r.merchantText ?? '—'}</td>
                    <td className='p-2 border'>
                      {r.date ? r.date.split('T')[0] : '—'}
                    </td>
                    <td className='p-2 border'>
                      {r.totalMinor != null
                        ? (r.totalMinor / 100).toFixed(2)
                        : '—'}
                    </td>
                    <td className='p-2 border'>
                      {r.vatMinor != null ? (r.vatMinor / 100).toFixed(2) : '—'}
                    </td>
                    <td className='p-2 border'>
                      <span className='rounded bg-gray-100 px-2 py-0.5'>
                        {runningOcrId === r.id
                          ? 'processing…'
                          : r.status ?? '—'}
                      </span>
                    </td>
                    <td className='p-2 border'>
                      <div className='flex gap-2'>
                        <button
                          className='rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50'
                          onClick={() => runOcr(r.id)}
                          disabled={runningOcrId === r.id}
                          title='Run OCR'
                        >
                          Run OCR
                        </button>
                        <a
                          className='rounded border px-2 py-1 hover:bg-gray-50'
                          href={`/inbox`}
                          title='Open Inbox'
                        >
                          Review
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={8} className='p-4 text-center text-gray-500'>
                      No uploads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
