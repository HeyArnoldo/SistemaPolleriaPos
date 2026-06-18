import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial del hub carbopuntos.
 * Escrita a mano (no generada contra DB) para garantizar coherencia con las entidades
 * y con el diseño en docs/CARBOPUNTOS-ANALISIS.md §6.
 *
 * Orden de creación:
 *   1. customers
 *   2. points_balances (FK lógica a customers)
 *   3. points_movements (FK lógica a customers)
 *   4. admin_audits (FK lógica a customers + points_movements)
 *   5. sede_credentials
 *
 * Índices:
 *   - customers.dni UNIQUE
 *   - points_balances.customer_id UNIQUE
 *   - points_movements.idempotency_key UNIQUE (nullable: índice parcial)
 *   - points_movements.customer_id (búsquedas de historial)
 *   - sede_credentials.sede UNIQUE
 */
export class CreateCarbopuntosSchema1750000000000 implements MigrationInterface {
  name = 'CreateCarbopuntosSchema1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensión requerida para uuid_generate_v4().
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Enum: tipos de movimiento ────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."points_movements_type_enum" AS ENUM('accrual', 'redeem', 'adjustment', 'reversal')`,
    );

    // ── Enum: tipos de acción de auditoría ───────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."admin_audits_action_enum" AS ENUM('adjust', 'void')`,
    );

    // ── Tabla: customers ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "dni"        varchar(8)  NOT NULL,
        "first_name" varchar     NOT NULL,
        "last_name"  varchar     NOT NULL,
        "full_name"  varchar     NOT NULL,
        "phone"      varchar         NULL,
        "consent_at" timestamptz NOT NULL,
        "is_active"  boolean     NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers_dni" UNIQUE ("dni")
      )
    `);

    // ── Tabla: points_balances ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "points_balances" (
        "id"          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid        NOT NULL,
        "balance"     integer     NOT NULL DEFAULT 0,
        "version"     integer     NOT NULL DEFAULT 0,
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_points_balances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_points_balances_customer_id" UNIQUE ("customer_id")
      )
    `);

    // ── Tabla: points_movements ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "points_movements" (
        "id"               uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id"      uuid        NOT NULL,
        "type"             "public"."points_movements_type_enum" NOT NULL,
        "points"           integer     NOT NULL,
        "balance_before"   integer     NOT NULL,
        "balance_after"    integer     NOT NULL,
        "sede"             varchar     NOT NULL,
        "user_ref"         varchar     NOT NULL,
        "sale_ref"         varchar         NULL,
        "detail"           varchar         NULL,
        "idempotency_key"  varchar         NULL,
        "is_voided"        boolean     NOT NULL DEFAULT false,
        "voided_by"        varchar         NULL,
        "voided_at"        timestamptz     NULL,
        "void_reason"      varchar         NULL,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_points_movements" PRIMARY KEY ("id")
      )
    `);

    // idempotency_key: índice parcial único (excluye NULLs — válido en Postgres).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_points_movements_idempotency_key"
      ON "points_movements" ("idempotency_key")
      WHERE "idempotency_key" IS NOT NULL
    `);

    // Índice de historial por cliente.
    await queryRunner.query(`
      CREATE INDEX "IDX_points_movements_customer_id"
      ON "points_movements" ("customer_id")
    `);

    // ── Tabla: admin_audits ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "admin_audits" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "action"         "public"."admin_audits_action_enum" NOT NULL,
        "actor_ref"      varchar     NOT NULL,
        "sede"           varchar     NOT NULL,
        "customer_id"    uuid        NOT NULL,
        "movement_id"    uuid            NULL,
        "balance_before" integer     NOT NULL,
        "balance_after"  integer     NOT NULL,
        "reason"         varchar     NOT NULL,
        "payload"        jsonb           NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audits" PRIMARY KEY ("id")
      )
    `);

    // ── Tabla: sede_credentials ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "sede_credentials" (
        "id"               uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "sede"             varchar NOT NULL,
        "service_key_hash" varchar NOT NULL,
        "is_active"        boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_sede_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sede_credentials_sede" UNIQUE ("sede")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sede_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audits"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_points_movements_customer_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_points_movements_idempotency_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "points_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "points_balances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."admin_audits_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."points_movements_type_enum"`);
  }
}
