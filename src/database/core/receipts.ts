import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  storageUrl: text('storage_url'), // where the image will live (Cloudinary/S3 later)
  merchantText: text('merchant_text'),
  totalMinor: integer('total_minor'),
  vatMinor: integer('vat_minor'),
  status: text('status').default('uploaded'), // uploaded | parsed | reviewed
  ocrRawJson: jsonb('ocr_raw_json'), // keep raw OCR results for debugging
  date: timestamp('date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});
