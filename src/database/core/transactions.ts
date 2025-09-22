import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id'),
  date: timestamp('date'), // when it posted
  amountMinor: integer('amount_minor'), // cents; negative for debit, positive for credit
  currency: text('currency').default('DKK'),
  rawDescription: text('raw_description'), // bank’s original text
  merchantText: text('merchant_text'), // normalized (we’ll fill later)
  status: text('status').default('new'), // new | reviewed | reconciled
  createdAt: timestamp('created_at').defaultNow(),
});
