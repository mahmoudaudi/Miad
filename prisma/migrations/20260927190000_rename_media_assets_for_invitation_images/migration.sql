-- Preserve all uploaded-image rows while removing the retired Media feature name.
ALTER TABLE "media_assets" RENAME TO "invitation_images";

ALTER TABLE "invitation_images"
  RENAME CONSTRAINT "media_assets_pkey" TO "invitation_images_pkey";
ALTER TABLE "invitation_images"
  RENAME CONSTRAINT "media_assets_user_id_fkey" TO "invitation_images_user_id_fkey";
ALTER TABLE "invitation_images"
  RENAME CONSTRAINT "media_assets_invitation_id_fkey" TO "invitation_images_invitation_id_fkey";

ALTER INDEX "media_assets_invitation_id_idx" RENAME TO "invitation_images_invitation_id_idx";
