CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "cached_cifra" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_slug" text NOT NULL,
	"slug" text NOT NULL,
	"source_url" text NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_token" (
	"token" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"permission" text DEFAULT 'read' NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_folder" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_setlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"setlist_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"arrangement_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_setlist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_song" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"folder_id" uuid,
	"song_id" text NOT NULL,
	"arrangement_id" text DEFAULT (gen_random_uuid())::text NOT NULL,
	"source_artist_slug" text,
	"source_slug" text,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"artist_slug" text NOT NULL,
	"slug" text NOT NULL,
	"youtube_id" text,
	"song_data" jsonb NOT NULL,
	"tone" integer DEFAULT 0 NOT NULL,
	"capo" integer DEFAULT 0 NOT NULL,
	"ui_prefs" jsonb,
	"is_recent" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_token" ADD CONSTRAINT "share_token_snapshot_id_share_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."share_snapshot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setlist_item" ADD CONSTRAINT "user_setlist_item_setlist_id_user_setlist_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."user_setlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_song" ADD CONSTRAINT "user_song_folder_id_user_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."user_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cached_cifra_source" ON "cached_cifra" USING btree ("artist_slug","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_song_folder_arr" ON "user_song" USING btree ("user_id","folder_id","arrangement_id") WHERE "user_song"."folder_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_song_recent_arr" ON "user_song" USING btree ("user_id","arrangement_id") WHERE "user_song"."folder_id" is null and "user_song"."is_recent" = true;