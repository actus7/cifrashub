import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Section, StoredSongUiPrefs } from "@/lib/types";

const positionColumn = () => integer("position").notNull().default(0);

const timestampColumns = () => ({
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  }),
);

export const userFolders = pgTable(
  "user_folder",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    // FK to neon_auth."user" is applied by scripts/add-user-fk-cascade.sql
    // after drizzle-kit push, because Neon Auth owns that table.
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestampColumns(),
  },
);

export const cachedCifras = pgTable(
  "cached_cifra",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    artistSlug: text("artist_slug").notNull(),
    slug: text("slug").notNull(),
    sourceUrl: text("source_url").notNull(),
    html: text("html").notNull(),
    ...timestampColumns(),
  },
  (t) => ({
    uqCachedCifraSource: uniqueIndex("uq_cached_cifra_source").on(t.artistSlug, t.slug),
  }),
);

export const userSongs = pgTable(
  "user_song",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id").notNull(),
    folderId: uuid("folder_id").references(() => userFolders.id, {
      onDelete: "cascade",
    }),
    songId: text("song_id").notNull(),
    arrangementId: text("arrangement_id")
      .notNull()
      .default(sql`(gen_random_uuid())::text`),
    sourceArtistSlug: text("source_artist_slug"),
    sourceSlug: text("source_slug"),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    artistSlug: text("artist_slug").notNull(),
    slug: text("slug").notNull(),
    youtubeId: text("youtube_id"),
    songData: jsonb("song_data").notNull().$type<Section[]>(),
    tone: integer("tone").notNull().default(0),
    capo: integer("capo").notNull().default(0),
    uiPrefs: jsonb("ui_prefs").$type<StoredSongUiPrefs | null>(),
    isRecent: boolean("is_recent").notNull().default(false),
    position: positionColumn(),
    ...timestampColumns(),
  },
  (t) => ({
    uqFolderArrangement: uniqueIndex("uq_user_song_folder_arr")
      .on(t.userId, t.folderId, t.arrangementId)
      .where(sql`${t.folderId} is not null`),
    uqRecentArrangement: uniqueIndex("uq_user_song_recent_arr")
      .on(t.userId, t.arrangementId)
      .where(sql`${t.folderId} is null and ${t.isRecent} = true`),
  }),
);

export const userSetlists = pgTable("user_setlist", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  position: positionColumn(),
  ...timestampColumns(),
});

export const userSetlistItems = pgTable(
  "user_setlist_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    setlistId: text("setlist_id")
      .notNull()
      .references(() => userSetlists.id, { onDelete: "cascade" }),
    position: positionColumn(),
    arrangementId: text("arrangement_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
);

export const shareSnapshots = pgTable("share_snapshot", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  resourceType: text("resource_type").notNull(),
  payload: jsonb("payload").notNull().$type<unknown>(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const shareTokens = pgTable("share_token", {
  token: text("token")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => shareSnapshots.id, { onDelete: "cascade" }),
  permission: text("permission").notNull().default("read"),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const userFoldersRelations = relations(userFolders, ({ many }) => ({
  songs: many(userSongs),
}));

export const userSongsRelations = relations(userSongs, ({ one }) => ({
  folder: one(userFolders, {
    fields: [userSongs.folderId],
    references: [userFolders.id],
  }),
}));
