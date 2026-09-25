-- CreateTable
CREATE TABLE "community_designs" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "design_specification" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_designs_invitation_id_key" ON "community_designs"("invitation_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_designs_slug_key" ON "community_designs"("slug");

-- CreateIndex
CREATE INDEX "community_designs_is_published_category_created_at_idx" ON "community_designs"("is_published", "category", "created_at");

-- CreateIndex
CREATE INDEX "community_designs_creator_id_created_at_idx" ON "community_designs"("creator_id", "created_at");

-- AddForeignKey
ALTER TABLE "community_designs" ADD CONSTRAINT "community_designs_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_designs" ADD CONSTRAINT "community_designs_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
