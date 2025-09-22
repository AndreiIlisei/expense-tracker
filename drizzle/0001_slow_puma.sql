CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"date" timestamp,
	"amount_minor" integer,
	"currency" text DEFAULT 'DKK',
	"raw_description" text,
	"merchant_text" text,
	"status" text DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
