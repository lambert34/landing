CREATE TABLE "wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "family" varchar(16) NOT NULL,
  "address" varchar(42) NOT NULL,
  "derivation_path" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wallets_family_check" CHECK ("family" IN ('evm'))
);
CREATE UNIQUE INDEX "wallets_user_family_unique" ON "wallets" ("user_id","family");
CREATE UNIQUE INDEX "wallets_address_unique" ON "wallets" ("address");
CREATE INDEX "wallets_user_idx" ON "wallets" ("user_id");

CREATE TABLE "wallet_registration_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "family" varchar(16) NOT NULL,
  "address" varchar(42) NOT NULL,
  "message" varchar(1024) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_registration_family_check" CHECK ("family" IN ('evm'))
);
CREATE INDEX "wallet_registration_user_created_idx"
  ON "wallet_registration_challenges" ("user_id","created_at");
CREATE INDEX "wallet_registration_expires_idx"
  ON "wallet_registration_challenges" ("expires_at");
