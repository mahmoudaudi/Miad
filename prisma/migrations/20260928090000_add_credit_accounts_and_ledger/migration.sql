-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "credits_charged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "credits_refunded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "credits_reserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotency_key" VARCHAR(120),
ADD COLUMN     "model" VARCHAR(120),
ADD COLUMN     "provider" VARCHAR(50);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" UUID NOT NULL,
    "credit_account_id" UUID NOT NULL,
    "ai_usage_id" UUID,
    "idempotency_key" VARCHAR(140) NOT NULL,
    "entry_type" VARCHAR(30) NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_user_id_key" ON "credit_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_entries_idempotency_key_key" ON "credit_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_credit_account_id_created_at_idx" ON "credit_ledger_entries"("credit_account_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_ai_usage_id_idx" ON "credit_ledger_entries"("ai_usage_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_idempotency_key_key" ON "ai_usage"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "ai_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_status_created_at_idx" ON "ai_usage"("status", "created_at");

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce ledger immutability in the database, not only in application code.
-- Corrections must be written as new compensating entries (e.g. a REFUND)
-- so the financial history can never be rewritten after the fact.
CREATE OR REPLACE FUNCTION credit_ledger_entries_are_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit_ledger_entries is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON "credit_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION credit_ledger_entries_are_immutable();
