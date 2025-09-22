/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { parse as parseCsv } from 'csv-parse/sync';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import db, { schema } from '@/database/drizzle';

// ---------- helpers ----------
const NBSP = /\u00A0/g;
function normalizeHeader(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // ø->o, å->a
    .replace(NBSP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normDesc(s?: string | null) {
  if (!s) return null;
  return s.replace(NBSP, ' ').replace(/\s+/g, ' ').trim();
}

// dd.mm.yyyy | dd/mm/yyyy | yyyy-mm-dd | m/d/yyyy etc.
function parseDateFlexible(s?: string | null): Date | null {
  if (!s) return null;
  const str = s.trim();

  // yyyy-mm-dd
  let m = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

  // dd.mm.yyyy or dd/mm/yyyy
  m = str.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/);
  if (m) {
    const d = +m[1],
      mo = +m[2],
      y = +m[3] < 100 ? +m[3] + (m[3] < '50' ? 2000 : 1900) : +m[3];
    return new Date(Date.UTC(y, mo - 1, d));
  }

  // m/d/yyyy (US-style)
  m = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));

  // Excel date serialized as JS Date string
  const d = new Date(str);
  return isNaN(d.getTime())
    ? null
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDkAmount(s?: string | null): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // handle both "1.234,56" and "-113.35" or "-113,35"
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Drizzle duplicate check: same date + amount + description */
async function existsDuplicate(
  date: Date,
  amountMinor: number,
  rawDescription: string
) {
  const rows = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.date, date),
        eq(schema.transactions.amountMinor, amountMinor),
        eq(schema.transactions.rawDescription, rawDescription)
      )
    )
    .limit(1);
  return rows.length > 0;
}

// ---------- route ----------
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const name = (file as any).name?.toLowerCase?.() || '';
    const isXlsx =
      name.endsWith('.xlsx') || buf.slice(0, 2).toString('utf8') === 'PK';

    // Read into records (array of objects keyed by headers)
    let records: Array<Record<string, any>> = [];
    if (isXlsx) {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(ws, {
        raw: false,
        defval: '',
      }) as any[];
    } else {
      const text = buf.toString('utf8');
      const firstLine = text.split(/\r?\n/).find(Boolean) || '';
      const delimiter = firstLine.includes(';') ? ';' : ',';
      records = parseCsv(text, {
        columns: true,
        delimiter,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      }) as any[];
    }

    if (!records.length)
      return NextResponse.json({ inserted: 0, skipped: 0, totalParsed: 0 });

    // Build normalized header map (normalized -> original key)
    const headerMap: Record<string, string> = {};
    for (const key of Object.keys(records[0])) {
      headerMap[normalizeHeader(key)] = key;
    }

    // Two schema variants (normalized names)
    const DK = {
      posted: ['bogfort'], // Bogført
      desc: ['beskrivelse', 'tekst'],
      in: ['ind pa konto', 'indbetaling'],
      out: ['ud af konto', 'udbetaling'],
    };
    const EN = {
      // Bank Norwegian “English” export
      posted: ['bookdate', 'transactiondate', 'valuedate'],
      desc: ['text', 'description'],
      amount: ['amount'], // already DKK & signed
      type: ['type'], // e.g., "Reserveret"
    };

    const get = (row: Record<string, any>, keys: string[]) => {
      for (const k of keys) {
        const original = headerMap[k];
        if (
          original != null &&
          row[original] != null &&
          String(row[original]).trim() !== ''
        ) {
          return row[original];
        }
      }
      return '';
    };

    let inserted = 0,
      skipped = 0;
    const batch: Array<{
      date: Date;
      amountMinor: number;
      currency: string;
      rawDescription: string;
      merchantText: string | null;
      status: string;
    }> = [];

    for (const r of records) {
      // Detect which schema the row likely is by available headers
      const hasEN =
        !!headerMap['amount'] ||
        !!headerMap['transactiondate'] ||
        !!headerMap['bookdate'];
      const hasDK =
        !!headerMap['bogfort'] ||
        !!headerMap['ud af konto'] ||
        !!headerMap['ind pa konto'];

      let date: Date | null = null;
      let amountMinor: number | null = null;
      let desc: string | null = null;
      let status = 'new';

      if (hasEN) {
        const dateRaw = get(r, EN.posted); // BookDate -> TransactionDate -> ValueDate
        const amtRaw = get(r, EN.amount); // signed DKK amount
        const typeRaw = get(r, EN.type); // may be "Reserveret"
        desc = normDesc(get(r, EN.desc));

        date = parseDateFlexible(String(dateRaw || ''));
        // Amount is already signed; accept both dot/comma
        amountMinor = parseDkAmount(String(amtRaw || ''));
        if (/reserveret/i.test(String(typeRaw))) status = 'pending';
      }

      if (!hasEN && hasDK) {
        const dateRaw = get(r, DK.posted);
        const inRaw = get(r, DK.in);
        const outRaw = get(r, DK.out);
        desc = normDesc(get(r, DK.desc));

        date = parseDateFlexible(String(dateRaw || ''));
        const inMinor = parseDkAmount(String(inRaw || ''));
        const outMinor = parseDkAmount(String(outRaw || ''));
        amountMinor =
          inMinor != null ? inMinor : outMinor != null ? -outMinor : null;
      }

      if (!date || amountMinor == null || !desc) {
        skipped++;
        continue;
      }

      // de-dup
      // eslint-disable-next-line no-await-in-loop
      const dupe = await existsDuplicate(date, amountMinor, desc);
      if (dupe) {
        skipped++;
        continue;
      }

      batch.push({
        date,
        amountMinor,
        currency: 'DKK',
        rawDescription: desc,
        merchantText: null,
        status,
      });
    }

    if (batch.length) {
      await db.insert(schema.transactions).values(batch);
      inserted = batch.length;
    }

    return NextResponse.json({
      inserted,
      skipped,
      totalParsed: records.length,
      format: isXlsx ? 'xlsx' : 'csv',
      detected: Object.keys(headerMap),
    });
  } catch (e: any) {
    console.error('Import error:', e);
    return NextResponse.json(
      { error: e?.message || 'Import failed' },
      { status: 500 }
    );
  }
}
