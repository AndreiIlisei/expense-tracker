/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import db, { schema } from '@/database/drizzle';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // 1. Insert a fake receipt
    const inserted = await db
      .insert(schema.receipts)
      .values({
        storageUrl: 'https://example.com/fake-receipt.jpg',
        merchantText: 'Test Store',
        totalMinor: 1999, // 19.99 DKK
        vatMinor: 400, // 4.00 DKK
        status: 'uploaded',
      })
      .returning();

    // 2. Query all receipts
    const allReceipts = await db.select().from(schema.receipts);

    return NextResponse.json({
      inserted,
      allReceipts,
    });
  } catch (error) {
    console.error('❌ DB test error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
