export const runtime = 'nodejs';

import { and, gte, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db, { schema } from '@/database/drizzle';

function parseDate(d?: string | null) {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

// handy defaults: current month [1st .. (today+1)]
function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const { from: df, to: dt } = defaultRange();

  const where = and(
    gte(schema.transactions.date, from ?? df),
    lte(schema.transactions.date, to ?? dt)
  );

  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
      // sum of negatives (out), sum of positives (in)
      outMinor: sql<number>`coalesce(sum(case when ${schema.transactions.amountMinor} < 0 then ${schema.transactions.amountMinor} end), 0)`,
      inMinor: sql<number>`coalesce(sum(case when ${schema.transactions.amountMinor} > 0 then ${schema.transactions.amountMinor} end), 0)`,
    })
    .from(schema.transactions)
    .where(where);

  const out = Number(row?.outMinor || 0);
  const inc = Number(row?.inMinor || 0);

  return NextResponse.json({
    range: {
      from: (from ?? df).toISOString().slice(0, 10),
      to: (to ?? dt).toISOString().slice(0, 10),
    },
    count: Number(row?.count || 0),
    totalOutMinor: out, // negative number
    totalInMinor: inc, // positive number
    netMinor: inc + out,
  });
}
