CREATE TABLE "setlist_stage" (
	"setlist_id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"line_index" integer DEFAULT -1 NOT NULL,
	"transpose" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setlist_stage" ADD CONSTRAINT "setlist_stage_setlist_id_user_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."user_setlist"("id") ON DELETE cascade ON UPDATE no action;