-- AI Studio uploads may exist before an invitation is created. They remain
-- owner-scoped and become invitation-scoped atomically when explicitly used.
ALTER TABLE "invitation_images"
  ALTER COLUMN "invitation_id" DROP NOT NULL;

CREATE INDEX "invitation_images_user_id_invitation_id_created_at_idx"
  ON "invitation_images"("user_id", "invitation_id", "created_at");
