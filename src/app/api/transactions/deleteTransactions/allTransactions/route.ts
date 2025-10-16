export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

export async function DELETE(req: Request) {
  await db.delete(schema.transactions); // deletes all rows
  return NextResponse.json({ ok: true }, { status: 200 });
}
