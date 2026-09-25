-- Event list and ownership checks always filter by user_id.
CREATE INDEX "events_user_id_idx" ON "events"("user_id");
