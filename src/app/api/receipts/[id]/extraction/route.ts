export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';
import { eq } from 'drizzle-orm';
import {
  TextractClient,
  AnalyzeExpenseCommand,
} from '@aws-sdk/client-textract';
import { parseDateFlexible } from '@/lib/dateProcessing';

const toMinor = (s?: string | null) => {
  if (!s) return null;
  const n = Number(
    String(s)
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.')
  );
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 note: Promise here
) {
  try {
    const { id } = await ctx.params;
    // 1) Load receipt (need storageUrl)
    const [receipt] = await db
      .select()
      .from(schema.receipts)
      .where(eq(schema.receipts.id, Number(id)));

    if (!receipt)
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    if (!receipt.storageUrl)
      return NextResponse.json(
        { error: 'Receipt has no storageUrl' },
        { status: 400 }
      );

    // 2) Fetch file bytes (Cloudinary/S3 URL)
    const fileRes = await fetch(receipt.storageUrl);
    if (!fileRes.ok) throw new Error(`Fetch failed: ${fileRes.status}`);
    const bytes = new Uint8Array(await fileRes.arrayBuffer());

    // 3) Call Textract AnalyzeExpense (best for receipts/invoices)
    const client = new TextractClient({ region: process.env.AWS_REGION });
    const cmd = new AnalyzeExpenseCommand({ Document: { Bytes: bytes } });
    const ocr = await client.send(cmd);

    // 4) Extract a few key fields (keep it simple for now)
    const doc = ocr.ExpenseDocuments?.[0];
    const fields = doc?.SummaryFields ?? [];
    const find = (type: string) =>
      fields.find((f) => f.Type?.Text === type)?.ValueDetection?.Text ?? null;

    const merchantText = find('VENDOR_NAME') || find('RECEIVER_NAME');
    const dateText =
      find('INVOICE_RECEIPT_DATE') || find('ORDER_DATE') || find('DUE_DATE');

    const parsedDate = parseDateFlexible(dateText);

    const totalMinor = toMinor(find('TOTAL'));
    const vatMinor = toMinor(find('TAX'));

    // 5) Save results (also keep raw OCR JSON to iterate later)
    await db
      .update(schema.receipts)
      .set({
        merchantText: merchantText ?? receipt.merchantText ?? null,
        date: parsedDate ? parsedDate : null,
        totalMinor: totalMinor ?? receipt.totalMinor ?? null,
        vatMinor: vatMinor ?? receipt.vatMinor ?? null,
        ocrRawJson: ocr as any,
        status: 'parsed',
      })
      .where(eq(schema.receipts.id, receipt.id));

    return NextResponse.json({
      ok: true,
      id: receipt.id,
      merchantText,
      rawDateText: dateText,
      parsedDate,
      parsedDateISO: parsedDate ? parsedDate.toISOString() : null,
      totalMinor,
      vatMinor,
      engine: 'textract',
    });
  } catch (e: any) {
    console.error('Textract OCR error:', e);
    return NextResponse.json(
      { error: e?.message || 'OCR failed' },
      { status: 500 }
    );
  }
}
