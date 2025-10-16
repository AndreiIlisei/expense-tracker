export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { merchantText, date, totalMinor, vatMinor, status } = body;

  const [updated] = await db
    .update(schema.receipts)
    .set({
      merchantText,
      date: date ? new Date(date) : null,
      totalMinor,
      vatMinor,
      status,
    })
    .where(eq(schema.receipts.id, Number((await ctx.params).id)))
    .returning();

  return NextResponse.json(updated);
}
