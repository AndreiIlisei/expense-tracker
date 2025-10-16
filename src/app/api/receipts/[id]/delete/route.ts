export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const rid = Number((await ctx.params).id);
  if (!Number.isFinite(rid)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // unlink any transaction pointing to this receipt
  await db
    .update(schema.transactions)
    .set({ receiptId: null, status: 'new' }) // reset status if you want
    .where(eq(schema.transactions.receiptId, rid));

  // delete the receipt
  const [deleted] = await db
    .delete(schema.receipts)
    .where(eq(schema.receipts.id, rid))
    .returning({ id: schema.receipts.id });

  if (!deleted)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: deleted.id });
}
