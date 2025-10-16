export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

function startUTC(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 25), 100);
  const daysWindow = Math.max(Number(url.searchParams.get('days') ?? 7), 0);
  const toleranceMinor = Math.max(
    Number(url.searchParams.get('tolerance') ?? 150),
    0
  );
  const txId = url.searchParams.get('txId');
  const debug = url.searchParams.get('debug') === '1';

  // 1) fetch txs (optionally focus one)
  let txs: any[] = [];
  if (txId) {
    const id = Number(txId);
    const row = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id));
    txs = row.filter((t) => t.receiptId == null && (t.amountMinor ?? 0) <= 0);
  } else {
    txs = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          isNull(schema.transactions.receiptId),
          lte(schema.transactions.amountMinor, 0)
        )
      )
      .orderBy(desc(schema.transactions.date ?? schema.transactions.createdAt))
      .limit(limit);
  }

  if (debug) {
    console.log('=== RECON SUGGEST ===');
    console.log('params:', {
      txId,
      daysWindow,
      toleranceMinor,
      count: txs.length,
    });
  }

  const suggestions: Array<{
    transactionId: number;
    suggestions: Array<{
      tx: any;
      receipt: any;
      score: number;
      daysDiff: number;
      amountDiff: number;
    }>;
  }> = [];
  const diagnostics: any[] = [];

  for (const t of txs) {
    if (!t.date || t.amountMinor == null) {
      if (debug) console.log('skip tx (missing date/amount):', t.id);
      continue;
    }

    const txDate = new Date(t.date);
    const from = startUTC(addDays(txDate, -daysWindow));
    const toExcl = startUTC(addDays(txDate, daysWindow + 1)); // exclusive
    const targetAbs = Math.abs(t.amountMinor);

    if (debug) {
      console.log(
        `TX #${t.id}  amt=${t.amountMinor}  date=${
          t.date
        }  window=[${from.toISOString()} .. ${toExcl.toISOString()})`
      );
    }

    // 2) fetch candidates by date (or createdAt if date null) & status
    const candidates = await db
      .select()
      .from(schema.receipts)
      .where(
        and(
          or(
            and(
              gte(schema.receipts.date, from),
              lte(schema.receipts.date, toExcl)
            ),
            and(
              isNull(schema.receipts.date),
              gte(schema.receipts.createdAt, from),
              lte(schema.receipts.createdAt, toExcl)
            )
          ),
          or(
            eq(schema.receipts.status, 'parsed'),
            eq(schema.receipts.status, 'reviewed')
          )
        )
      )
      .orderBy(desc(schema.receipts.date ?? schema.receipts.createdAt))
      .limit(300);

    let noTotal = 0;
    let outsideTol = 0;

    const filtered = candidates
      .map((r) => {
        if (r.totalMinor == null) {
          noTotal++;
          return null;
        }
        const amountDiff = Math.abs((r.totalMinor as number) - targetAbs);
        if (amountDiff > toleranceMinor) {
          outsideTol++;
          return null;
        }
        const rd = r.date ? new Date(r.date) : new Date(r.createdAt!);
        const daysDiff = Math.abs(
          Math.floor((rd.getTime() - txDate.getTime()) / 86_400_000)
        );
        const score = daysDiff * 1000 + amountDiff;
        return { tx: t, receipt: r, score, daysDiff, amountDiff };
      })
      .filter(Boolean as any)
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, 3);

    if (debug) {
      const best = filtered[0];
      console.log(
        `  candidates=${candidates.length}  kept=${filtered.length}  noTotal=${noTotal}  outsideTol=${outsideTol}`,
        best
          ? `  best: r#${best.receipt.id}  rAmt=${best.receipt.totalMinor}  Δamt=${best.amountDiff}  Δdays=${best.daysDiff}`
          : ''
      );
    }

    diagnostics.push({
      transactionId: t.id,
      tx: {
        id: t.id,
        date: t.date,
        amountMinor: t.amountMinor,
        rawDescription: t.rawDescription,
      },
      window: { from: from.toISOString(), toExcl: toExcl.toISOString() },
      considered: candidates.length,
      filteredOut: { noTotal, outsideTolerance: outsideTol },
      kept: filtered.length,
      top: filtered[0]
        ? {
            receiptId: filtered[0].receipt.id,
            receiptDate:
              filtered[0].receipt.date ?? filtered[0].receipt.createdAt,
            totalMinor: filtered[0].receipt.totalMinor,
            daysDiff: filtered[0].daysDiff,
            amountDiff: filtered[0].amountDiff,
          }
        : null,
    });

    if (filtered.length) {
      suggestions.push({ transactionId: t.id, suggestions: filtered });
    }
  }

  const payload: any = { suggestions, config: { daysWindow, toleranceMinor } };
  if (debug) payload.diagnostics = diagnostics;

  return NextResponse.json(payload);
}

// export const runtime = 'nodejs';

// import { NextResponse } from 'next/server';
// import db, { schema } from '@/database/drizzle';
// import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

// function startUTC(d: Date) {
//   return new Date(
//     Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
//   );
// }
// function addDays(d: Date, n: number) {
//   const x = new Date(d);
//   x.setUTCDate(x.getUTCDate() + n);
//   return x;
// }

// export async function GET(req: Request) {
//   const url = new URL(req.url);
//   const limit = Math.min(Number(url.searchParams.get('limit') ?? 25), 100);
//   const daysWindow = Math.max(Number(url.searchParams.get('days') ?? 7), 0); // ±N days
//   const toleranceMinor = Math.max(
//     Number(url.searchParams.get('tolerance') ?? 150),
//     0
//   );

//   // 1) get recent, unlinked expense transactions
//   const txs = await db
//     .select()
//     .from(schema.transactions)
//     .where(
//       and(
//         isNull(schema.transactions.receiptId),
//         lte(schema.transactions.amountMinor, 0) // expenses only
//       )
//     )
//     .orderBy(desc(schema.transactions.date ?? schema.transactions.createdAt))
//     .limit(limit);

//   // console.log(txs);

//   const suggestions: Array<{
//     transactionId: number;
//     suggestions: Array<{
//       tx: any;
//       receipt: any;
//       score: number;
//       daysDiff: number;
//       amountDiff: number;
//     }>;
//   }> = [];

//   for (const t of txs) {
//     if (!t.date || t.amountMinor == null) continue;

//     const txDate = new Date(t.date);
//     const from = startUTC(addDays(txDate, -daysWindow));
//     const toExcl = startUTC(addDays(txDate, daysWindow + 1)); // exclusive upper bound
//     const targetAbs = Math.abs(t.amountMinor);

//     // 2) candidate receipts: within date (or createdAt) window, with totals present, and sensible status
//     const candidates = await db
//       .select()
//       .from(schema.receipts)
//       .where(
//         and(
//           // use receipt.date if it exists; otherwise fallback to createdAt
//           or(
//             and(
//               gte(schema.receipts.date, from),
//               lte(schema.receipts.date, toExcl)
//             ),
//             and(
//               isNull(schema.receipts.date),
//               gte(schema.receipts.createdAt, from),
//               lte(schema.receipts.createdAt, toExcl)
//             )
//           ),
//           or(
//             eq(schema.receipts.status, 'parsed'),
//             eq(schema.receipts.status, 'reviewed')
//           )
//         )
//       )
//       .orderBy(desc(schema.receipts.date ?? schema.receipts.createdAt))
//       .limit(200);

//     console.log('THIS IS', candidates);

//     // 3) filter by amount tolerance and score
//     const filtered = candidates
//       .filter((r) => r.totalMinor != null)
//       .filter(
//         (r) => Math.abs((r.totalMinor as number) - targetAbs) <= toleranceMinor
//       )
//       .map((r) => {
//         const rd = r.date ? new Date(r.date) : new Date(r.createdAt!);
//         const daysDiff = Math.abs(
//           Math.floor((rd.getTime() - txDate.getTime()) / 86_400_000)
//         );
//         const amountDiff = Math.abs((r.totalMinor as number) - targetAbs);
//         const score = daysDiff * 1000 + amountDiff; // simple sorting heuristic
//         return { tx: t, receipt: r, score, daysDiff, amountDiff };
//       })
//       .sort((a, b) => a.score - b.score)
//       .slice(0, 3);

//     if (filtered.length) {
//       suggestions.push({ transactionId: t.id, suggestions: filtered });
//     }
//   }

//   return NextResponse.json({
//     suggestions,
//     config: { daysWindow, toleranceMinor },
//   });
// }
