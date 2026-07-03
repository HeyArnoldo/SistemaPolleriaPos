import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrlToPaymentMethod1783052688083 implements MigrationInterface {
  name = 'AddImageUrlToPaymentMethod1783052688083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Stores the QR image for the payment method (e.g. Yape QR).
    // Type is `text` (not varchar) to support data URLs (base64-encoded images).
    // Recommended limit: keep data URLs under ~200 KB for reasonable DB row sizes.
    // URLs (http/https) are always compact; only base64 data URIs are large.
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
        ADD COLUMN IF NOT EXISTS "image_url" text DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
        DROP COLUMN IF EXISTS "image_url"
    `);
  }
}
