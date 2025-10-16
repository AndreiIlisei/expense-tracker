'use client';

import { useEffect, useState } from 'react';

type Tx = {
  id: number;
  date: string | null;
  amountMinor: number | null;
  rawDescription: string | null;
};
type Rcpt = {
  id: number;
  storageUrl: string | null;
  merchantText: string | null;
  date: string | null;
  totalMinor: number | null;
};
type Suggestion = {
  transactionId: number;
  suggestions: Array<{
    tx: Tx;
    receipt: Rcpt;
    score: number;
    daysDiff: number;
    amountDiff: number;
  }>;
};

export default function MatchesPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/reconciliation/suggest');
    console.log(r);
    const j = await r.json();
    console.log(j);
    setItems(j.suggestions || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(transactionId: number, receiptId: number) {
    setPending(transactionId);
    setError(null);
    try {
      const r = await fetch('/api/reconciliation/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, receiptId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to accept');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setPending(null);
    }
  }

  async function markNotNeeded(transactionId: number) {
    setPending(transactionId);
    setError(null);
    try {
      const r = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'not_needed' }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to update');
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>🔗 Matches</h1>
        <button
          onClick={load}
          className='rounded border px-3 py-1 text-sm hover:bg-gray-50'
        >
          Refresh
        </button>
      </div>
      {error && <div className='text-sm text-red-600'>{error}</div>}

      {items.length === 0 ? (
        <div className='text-gray-500'>No suggestions right now.</div>
      ) : (
        <div className='space-y-4'>
          {items.map((group) => {
            const tx = group.suggestions[0].tx;
            return (
              <div key={group.transactionId} className='rounded-xl border'>
                <div className='flex items-center justify-between border-b bg-gray-50 px-4 py-2'>
                  <div className='text-sm'>
                    <span className='font-medium'>Tx #{tx.id}</span> •{' '}
                    {(tx.amountMinor ?? 0) / 100} DKK
                    {' • '}
                    {tx.date ? tx.date.split('T')[0] : '—'}
                    {' • '}
                    {tx.rawDescription || '—'}
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => markNotNeeded(group.transactionId)}
                      className='rounded border px-3 py-1 text-sm hover:bg-gray-50'
                      disabled={pending === group.transactionId}
                      title='Mark that no receipt is needed'
                    >
                      Mark not needed
                    </button>
                  </div>
                </div>

                <div className='divide-y'>
                  {group.suggestions.map((s) => (
                    <div
                      key={s.receipt.id}
                      className='flex items-center gap-3 px-4 py-3'
                    >
                      <a
                        href={s.receipt.storageUrl || '#'}
                        target='_blank'
                        rel='noreferrer'
                        className='block'
                        title='Open image'
                      >
                        <img
                          src={s.receipt.storageUrl || ''}
                          alt={`Receipt ${s.receipt.id}`}
                          className='h-16 w-auto rounded border object-contain'
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.visibility = 'hidden';
                          }}
                        />
                      </a>
                      <div className='flex-1 text-sm'>
                        <div className='font-medium'>
                          Receipt #{s.receipt.id} •{' '}
                          {s.receipt.merchantText || '—'}
                        </div>
                        <div className='text-gray-600'>
                          {s.receipt.date ? s.receipt.date.split('T')[0] : '—'}{' '}
                          • {(s.receipt.totalMinor ?? 0) / 100} DKK
                          {'  '}
                          <span className='text-gray-400'>
                            (Δdays {s.daysDiff}, Δamount {s.amountDiff / 100}{' '}
                            DKK)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          accept(group.transactionId, s.receipt.id)
                        }
                        className='rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50'
                        disabled={pending === group.transactionId}
                      >
                        {pending === group.transactionId
                          ? 'Linking…'
                          : 'Accept'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
