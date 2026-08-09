ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;
CREATE TABLE "auth_challenges" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"email" varchar(320) NOT NULL,"purpose" varchar(16) NOT NULL,"code_digest" varchar(64) NOT NULL,"expires_at" timestamp with time zone NOT NULL,"consumed_at" timestamp with time zone,"attempt_count" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,CONSTRAINT "auth_challenges_purpose_check" CHECK ("purpose" IN ('signup','login')));
CREATE INDEX "auth_challenges_email_created_idx" ON "auth_challenges" ("email","created_at");
CREATE INDEX "auth_challenges_expires_idx" ON "auth_challenges" ("expires_at");
CREATE TABLE "sessions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,"token_hash" varchar(64) NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"expires_at" timestamp with time zone NOT NULL,"last_seen_at" timestamp with time zone,"revoked_at" timestamp with time zone);
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" ("token_hash"); CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id"); CREATE INDEX "sessions_expires_idx" ON "sessions" ("expires_at");
CREATE TABLE "auth_audit_events" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"event" varchar(48) NOT NULL,"user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,"subject_hash" varchar(64),"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE INDEX "auth_audit_created_idx" ON "auth_audit_events" ("created_at"); CREATE INDEX "auth_audit_user_idx" ON "auth_audit_events" ("user_id");
