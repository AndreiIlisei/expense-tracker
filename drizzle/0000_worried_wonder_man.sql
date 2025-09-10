CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"storage_url" text,
	"ocr_raw_json" jsonb,
	"merchant_text" text,
	"date" timestamp DEFAULT now(),
	"total_minor" integer,
	"vat_minor" integer,
	"status" text DEFAULT 'uploaded',
	"created_at" timestamp DEFAULT now()
);
