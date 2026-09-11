CREATE TABLE "ai_credentials" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text,
	"model" text,
	"api_key_enc" text,
	"key_hint" text,
	"input_usd_per_mtok" double precision,
	"output_usd_per_mtok" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credentials_purpose_ck" CHECK (purpose IN ('model', 'search')),
	CONSTRAINT "ai_credentials_kind_ck" CHECK ((purpose = 'model' AND kind IN ('anthropic', 'openai', 'gemini', 'openrouter', 'openai_compatible'))
				OR (purpose = 'search' AND kind IN ('brave', 'tavily')))
);
--> statement-breakpoint
CREATE TABLE "ai_job_sources" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" bigint NOT NULL,
	"key" text NOT NULL,
	"origin" text NOT NULL,
	"url" text NOT NULL,
	"final_url" text,
	"title" text DEFAULT '' NOT NULL,
	"site_name" text DEFAULT '' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"published_at" text,
	"status" text NOT NULL,
	"error" text,
	"trusted" boolean DEFAULT false NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_job_sources_status_ck" CHECK (status IN ('ok', 'failed', 'blocked')),
	CONSTRAINT "ai_job_sources_origin_ck" CHECK (origin IN ('seed', 'search'))
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"locale" text NOT NULL,
	"category_id" bigint,
	"idea" text NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"seed_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"model_credential_id" bigint,
	"search_credential_id" bigint,
	"model_label" text NOT NULL,
	"claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outline" jsonb,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"article_id" bigint,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ai_jobs_status_ck" CHECK (status IN ('queued', 'researching', 'review', 'drafting', 'done', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"trusted_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"blocked_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"weekly_limit" integer DEFAULT 5 NOT NULL,
	"monthly_budget_usd" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_single_row_ck" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "ai_job_sources" ADD CONSTRAINT "ai_job_sources_job_id_ai_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_model_credential_id_ai_credentials_id_fk" FOREIGN KEY ("model_credential_id") REFERENCES "public"."ai_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_search_credential_id_ai_credentials_id_fk" FOREIGN KEY ("search_credential_id") REFERENCES "public"."ai_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_job_sources_key_idx" ON "ai_job_sources" USING btree ("job_id","key");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_jobs_created_idx" ON "ai_jobs" USING btree ("created_at");