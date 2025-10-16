export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .returning({ id: schema.transactions.id });

  if (!deleted)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: deleted.id });
}
