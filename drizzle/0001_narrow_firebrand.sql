CREATE INDEX "idx_user_folder_user_position" ON "user_folder" USING btree ("user_id","position","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_setlist_item_setlist_position" ON "user_setlist_item" USING btree ("setlist_id","position","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_setlist_user_position" ON "user_setlist" USING btree ("user_id","position","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_song_user_folder_recent_position" ON "user_song" USING btree ("user_id","folder_id","is_recent","position");--> statement-breakpoint
CREATE INDEX "idx_user_song_user_arrangement" ON "user_song" USING btree ("user_id","arrangement_id");
