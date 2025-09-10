export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { and, desc, eq, gt, lt, or } from 'drizzle-orm';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // e.g. "uploaded" | "parsed" | "reviewed"
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const cursor = url.searchParams.get('cursor'); // simple cursor by id
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const where = and(
    status ? eq(schema.receipts.status, status) : undefined,
    cursor
      ? dir === 'asc'
        ? gt(schema.receipts.id, Number(cursor))
        : lt(schema.receipts.id, Number(cursor))
      : undefined
  );

  const rows = await db
    .select()
    .from(schema.receipts)
    .where(where)
    .orderBy(dir === 'asc' ? schema.receipts.id : desc(schema.receipts.id))
    .limit(Math.min(Math.max(limit, 1), 500));

  const nextCursor = rows.length ? rows[rows.length - 1].id : null;

  return NextResponse.json({
    items: rows,
    nextCursor,
    hasMore: !!nextCursor && rows.length >= limit,
  });
}
