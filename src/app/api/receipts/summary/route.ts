export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { sql } from 'drizzle-orm';

export async function GET() {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
      totalMinor: sql<number>`coalesce(sum(${schema.receipts.totalMinor}), 0)`,
      vatMinor: sql<number>`coalesce(sum(${schema.receipts.vatMinor}), 0)`,
    })
    .from(schema.receipts);

  return NextResponse.json({
    count: Number(row.count || 0),
    totalMinor: Number(row.totalMinor || 0),
    vatMinor: Number(row.vatMinor || 0),
  });
}
