-- DropForeignKey
ALTER TABLE "content_import_error" DROP CONSTRAINT "content_import_error_import_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "content_import_error" DROP CONSTRAINT "content_import_error_raw_item_id_fkey";

-- DropForeignKey
ALTER TABLE "content_import_mapping" DROP CONSTRAINT "content_import_mapping_import_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "content_raw_item" DROP CONSTRAINT "content_raw_item_import_batch_id_fkey";

-- DropIndex
DROP INDEX "idx_content_import_batch_status_created_at";

-- AlterTable
ALTER TABLE "content_import_batch" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "content_import_mapping" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "idx_content_import_batch_status_created_at" ON "content_import_batch"("status", "created_at");

-- AddForeignKey
ALTER TABLE "content_raw_item" ADD CONSTRAINT "content_raw_item_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "content_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_import_error" ADD CONSTRAINT "content_import_error_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "content_import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_import_error" ADD CONSTRAINT "content_import_error_raw_item_id_fkey" FOREIGN KEY ("raw_item_id") REFERENCES "content_raw_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_import_mapping" ADD CONSTRAINT "content_import_mapping_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "content_import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
