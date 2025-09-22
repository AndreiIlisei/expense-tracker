export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date ?? schema.transactions.createdAt));
  return NextResponse.json(rows);
}
