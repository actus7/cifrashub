CREATE TABLE "user_entitlement" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'pro' NOT NULL,
	"active_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
