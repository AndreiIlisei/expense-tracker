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

function parseAmountFlexible(v?: unknown): number | null {
  if (v === null || v === undefined) return null;

  // If Excel already gave us a number
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.round(v * 100);
  }

  // Otherwise parse string
  let s = String(v).trim();
  if (!s) return null;

  // Normalize unicode minus and spaces
  s = s
    .replace(/\u2212/g, '-') // unicode minus → hyphen
    .replace(/\u00A0/g, '') // NBSP
    .replace(/\s+/g, ''); // all spaces

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Keep the last separator as decimal, drop the other as thousands
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decSep = lastComma > lastDot ? ',' : '.';
    const grpSep = decSep === ',' ? '.' : ',';
    s = s.split(grpSep).join(''); // remove thousands sep
    s = s.replace(decSep, '.'); // unify decimal
  } else if (hasComma) {
    // "1.234,56" or "80,35"
    s = s.split('.').join(''); // remove thousands dots if any
    s = s.replace(',', '.'); // decimal is comma
  } else if (hasDot) {
    // "80.35" or "1,234.56" (remove commas if present)
    s = s.split(',').join('');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const MS_PER_DAY = 86_400_000;

// Excel serial → UTC Date (Excel epoch 1899-12-30; handles leap bug implicitly)
function excelSerialToUTCDate(n: number): Date {
  // Some banks export serials as whole numbers (days) or with time fractions.
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + n * MS_PER_DAY);
}

function toUTCDateYMD(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

// Accepts Date | number (Excel serial) | string
function parseDateAny(v: unknown): Date | null {
  if (v == null || v === '') return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return toUTCDateYMD(v);
  }

  if (typeof v === 'number' && isFinite(v)) {
    // Heuristic: Excel serials are typically > 20_000
    if (v > 20000 && v < 80000) {
      return toUTCDateYMD(excelSerialToUTCDate(v));
    }
    // If someone exports a unix timestamp (seconds/ms) — optional support:
    if (v > 1e12) return toUTCDateYMD(new Date(v)); // ms
    if (v > 1e9) return toUTCDateYMD(new Date(v * 1000)); // seconds
  }

  if (typeof v === 'string') {
    const s = v.trim();

    // yyyy-mm-dd
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

    // dd.mm.yyyy or dd/mm/yy(yy)
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
      const d = +m[1],
        mo = +m[2];
      let y = +m[3];
      if (y < 100) y += y < 50 ? 2000 : 1900; // 00–49 => 2000-2049, 50–99 => 1950-1999
      return new Date(Date.UTC(y, mo - 1, d));
    }

    // m/d/yy(yy)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const mo = +m[1],
        d = +m[2];
      let y = +m[3];
      if (y < 100) y += y < 50 ? 2000 : 1900;
      return new Date(Date.UTC(y, mo - 1, d));
    }

    // Last resort: Date.parse
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return toUTCDateYMD(d2);
  }

  return null;
}

// Drizzle duplicate check: same date + amount + description
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
      // AFTER
      const wb = XLSX.read(buf, {
        type: 'buffer',
        cellDates: true, // return Date objects when cell type is date
        cellNF: false,
        raw: true, // keep raw values (Date | number | string)
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(ws, {
        raw: true,
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

        date = parseDateAny(String(dateRaw || ''));
        // Amount is already signed; accept both dot/comma
        amountMinor = parseAmountFlexible(String(amtRaw || ''));
        if (/reserveret/i.test(String(typeRaw))) status = 'pending';
      }

      if (!hasEN && hasDK) {
        const dateRaw = get(r, DK.posted);
        const inRaw = get(r, DK.in);
        const outRaw = get(r, DK.out);
        desc = normDesc(get(r, DK.desc));

        date = parseDateAny(String(dateRaw || ''));
        const inMinor = parseAmountFlexible(String(inRaw || ''));
        const outMinor = parseAmountFlexible(String(outRaw || ''));
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
