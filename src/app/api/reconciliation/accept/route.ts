export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

export async function POST(req: Request) {
  const { transactionId, receiptId } = await req.json();

  if (!transactionId || !receiptId) {
    return NextResponse.json(
      { error: 'transactionId and receiptId are required' },
      { status: 400 }
    );
  }

  // set the link on the transaction; optionally update statuses
  const [updated] = await db
    .update(schema.transactions)
    .set({ receiptId, status: 'reconciled' })
    .where(eq(schema.transactions.id, Number(transactionId)))
    .returning();

  // Get current receipt
  const [r] = await db
    .select({
      id: schema.receipts.id,
      date: schema.receipts.date,
      createdAt: schema.receipts.createdAt,
    })
    .from(schema.receipts)
    .where(eq(schema.receipts.id, Number(receiptId)))
    .limit(1);

  const txDate = updated?.date ?? null;

  // Treat “date == createdAt” as a bogus default we want to replace
  const looksLikeDefault =
    r &&
    r.date &&
    r.createdAt &&
    new Date(r.date).getTime() === new Date(r.createdAt).getTime();

  if (txDate && (!r?.date || looksLikeDefault)) {
    await db
      .update(schema.receipts)
      .set({ status: 'reviewed', date: txDate })
      .where(eq(schema.receipts.id, Number(receiptId)));
  } else {
    await db
      .update(schema.receipts)
      .set({ status: 'reviewed' })
      .where(eq(schema.receipts.id, Number(receiptId)));
  }

  // also mark receipt as reviewed if you want:
  await db
    .update(schema.receipts)
    .set({ status: 'reviewed' })
    .where(eq(schema.receipts.id, Number(receiptId)));

  return NextResponse.json({ ok: true, updated });
}
