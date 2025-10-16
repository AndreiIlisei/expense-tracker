export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [receipt] = await db
    .select()
    .from(schema.receipts)
    .where(eq(schema.receipts.id, id))
    .limit(1);

  if (!receipt)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(receipt);
}
