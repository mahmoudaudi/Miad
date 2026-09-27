-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "published_design_version" INTEGER;

UPDATE "invitations" AS invitation
SET "published_design_version" = (
  SELECT design."version"
  FROM "invitation_designs" AS design
  WHERE design."invitation_id" = invitation."id"
    AND design."is_active" = true
  ORDER BY design."version" DESC
  LIMIT 1
)
WHERE invitation."status" = 'PUBLISHED'
  AND invitation."published_at" IS NOT NULL;
