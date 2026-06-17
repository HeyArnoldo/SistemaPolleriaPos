import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosSchema1781200000000 implements MigrationInterface {
  name = 'PosSchema1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── profiles ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "id" SERIAL PRIMARY KEY,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "avatar_url" varchar(255) DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── Update users table to POS schema ─────────────────────────────────────
    // Drop old columns added by InitSchema and add POS columns
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "name"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "createdAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "updatedAt"`);

    // Drop the old uuid-based id and recreate as serial int
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "id"`);

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "id" SERIAL PRIMARY KEY`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "username" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role" varchar(20) NOT NULL DEFAULT 'cashier'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "profile_id" integer REFERENCES "profiles"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "created_at" timestamptz NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now()`,
    );

    // Remove defaults used during column addition
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT`);

    // ── product_categories ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_product_categories_name" UNIQUE ("name")
      )
    `);

    // ── products ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "image_url" varchar(500) DEFAULT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "category_id" integer NOT NULL REFERENCES "product_categories"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_products_name" UNIQUE ("name")
      )
    `);

    // ── payment_methods ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "payment_methods" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "commission_percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "requires_transfer_time" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_methods_name" UNIQUE ("name")
      )
    `);

    // ── sales ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" SERIAL PRIMARY KEY,
        "sale_number" varchar(50) NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "total_amount" decimal(12,2) NOT NULL,
        "subtotal" decimal(12,2) NOT NULL,
        "tax_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "payment_status" varchar(50) NOT NULL DEFAULT 'paid',
        "notes" varchar(500) DEFAULT NULL,
        "is_canceled" boolean NOT NULL DEFAULT false,
        "cancel_reason" varchar(500) DEFAULT NULL,
        "canceled_at" timestamptz DEFAULT NULL,
        "canceled_by" integer REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sales_sale_number" UNIQUE ("sale_number")
      )
    `);

    // ── sale_items ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "id" SERIAL PRIMARY KEY,
        "sale_id" integer NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
        "product_id" integer NOT NULL REFERENCES "products"("id"),
        "quantity" integer NOT NULL,
        "unit_price" decimal(10,2) NOT NULL,
        "subtotal" decimal(12,2) NOT NULL
      )
    `);

    // ── payments ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" SERIAL PRIMARY KEY,
        "sale_id" integer NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
        "payment_method_id" integer NOT NULL REFERENCES "payment_methods"("id"),
        "amount" decimal(12,2) NOT NULL,
        "gross_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "net_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "commission_percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "commission_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "transfer_time" time DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── expenses ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "expenses" (
        "id" SERIAL PRIMARY KEY,
        "description" varchar(255) NOT NULL,
        "amount" decimal(12,2) NOT NULL,
        "receipt_number" varchar(100) DEFAULT NULL,
        "payment_method_id" integer NOT NULL REFERENCES "payment_methods"("id"),
        "user_id" integer REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── store_settings ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "store_settings" (
        "id" SERIAL PRIMARY KEY,
        "store_name" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);

    // Revert users to original schema is complex — dropping POS columns only
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "created_at"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "profiles"`);
  }
}
