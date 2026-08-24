-- Post-drizzle migration. Adds ON DELETE CASCADE foreign keys from app data
-- to neon_auth."user", the Neon Auth source of truth.
--
-- Run after drizzle-kit push so the push step cannot remove these external
-- schema references.

DELETE FROM public.share_token st
WHERE NOT EXISTS (
  SELECT 1 FROM public.share_snapshot ss WHERE ss.id = st.snapshot_id
);

DELETE FROM public.share_token st
USING public.share_snapshot ss
WHERE st.snapshot_id = ss.id
  AND NOT EXISTS (
    SELECT 1 FROM neon_auth."user" u WHERE u.id = ss.created_by_user_id
  );

DELETE FROM public.share_snapshot ss
WHERE NOT EXISTS (
  SELECT 1 FROM neon_auth."user" u WHERE u.id = ss.created_by_user_id
);

DELETE FROM public.user_setlist_item si
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_setlist sl WHERE sl.id = si.setlist_id
);

DELETE FROM public.user_setlist_item si
USING public.user_setlist sl
WHERE si.setlist_id = sl.id
  AND NOT EXISTS (
    SELECT 1 FROM neon_auth."user" u WHERE u.id = sl.user_id
  );

DELETE FROM public.user_setlist sl
WHERE NOT EXISTS (
  SELECT 1 FROM neon_auth."user" u WHERE u.id = sl.user_id
);

DELETE FROM public.user_song us
WHERE NOT EXISTS (
  SELECT 1 FROM neon_auth."user" u WHERE u.id = us.user_id
);

DELETE FROM public.user_folder uf
WHERE NOT EXISTS (
  SELECT 1 FROM neon_auth."user" u WHERE u.id = uf.user_id
);

DELETE FROM public.user_song us
WHERE us.folder_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_folder uf WHERE uf.id = us.folder_id
  );

DELETE FROM public.folder_member fm
WHERE NOT EXISTS (SELECT 1 FROM public.user_folder uf WHERE uf.id = fm.folder_id)
   OR NOT EXISTS (SELECT 1 FROM neon_auth."user" u WHERE u.id = fm.user_id);

DELETE FROM public.setlist_member sm
WHERE NOT EXISTS (SELECT 1 FROM public.user_setlist sl WHERE sl.id = sm.setlist_id)
   OR NOT EXISTS (SELECT 1 FROM neon_auth."user" u WHERE u.id = sm.user_id);

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = ANY(ARRAY_REMOVE(ARRAY[
        to_regclass('public.user_folder'),
        to_regclass('public.user_song'),
        to_regclass('public.user_setlist'),
        to_regclass('public.share_snapshot'),
        to_regclass('public.folder_member'),
        to_regclass('public.setlist_member')
      ], NULL))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_folder
  ADD CONSTRAINT user_folder_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.user_song
  ADD CONSTRAINT user_song_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.user_song
  ADD CONSTRAINT user_song_folder_id_fkey
  FOREIGN KEY (folder_id) REFERENCES public.user_folder(id) ON DELETE CASCADE;

ALTER TABLE public.user_setlist
  ADD CONSTRAINT user_setlist_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.share_snapshot
  ADD CONSTRAINT share_snapshot_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.folder_member
  ADD CONSTRAINT folder_member_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

ALTER TABLE public.setlist_member
  ADD CONSTRAINT setlist_member_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE;
