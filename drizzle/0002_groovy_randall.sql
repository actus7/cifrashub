-- neon_auth."user" is owned by Neon Auth; its CREATE was removed by hand (see docs/runbooks/db-migrations.md).
CREATE TABLE "folder_member" (
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folder_member_folder_id_user_id_pk" PRIMARY KEY("folder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "setlist_member" (
	"setlist_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "setlist_member_setlist_id_user_id_pk" PRIMARY KEY("setlist_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "folder_member" ADD CONSTRAINT "folder_member_folder_id_user_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."user_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_member" ADD CONSTRAINT "setlist_member_setlist_id_user_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."user_setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_folder_member_user" ON "folder_member" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_setlist_member_user" ON "setlist_member" USING btree ("user_id","created_at");