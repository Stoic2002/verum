CREATE TABLE "categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_locales" (
	"category_id" bigint NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "category_locales_category_id_locale_pk" PRIMARY KEY("category_id","locale"),
	CONSTRAINT "category_locale_ck" CHECK (locale IN ('en', 'id'))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topic_locales" (
	"topic_id" bigint NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"intro_md" text NOT NULL,
	"intro_html" text DEFAULT '' NOT NULL,
	CONSTRAINT "topic_locales_topic_id_locale_pk" PRIMARY KEY("topic_id","locale"),
	CONSTRAINT "topic_locale_ck" CHECK (locale IN ('en', 'id'))
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"r2_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"credit" text,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "article_locales" (
	"article_id" bigint NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body_md" text NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"toc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reading_minutes" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"meta_title" text,
	"meta_desc" text,
	"published_at" timestamp with time zone,
	"modified_at" timestamp with time zone,
	"correction" text,
	"search_vector" "tsvector",
	CONSTRAINT "article_locales_article_id_locale_pk" PRIMARY KEY("article_id","locale"),
	CONSTRAINT "article_locale_ck" CHECK (locale IN ('en', 'id'))
);
--> statement-breakpoint
CREATE TABLE "article_tags" (
	"article_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "article_tags_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_living" boolean DEFAULT false NOT NULL,
	"cover_media_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_status_ck" CHECK (status IN ('draft', 'scheduled', 'published', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "topic_articles" (
	"topic_id" bigint NOT NULL,
	"article_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "topic_articles_topic_id_article_id_pk" PRIMARY KEY("topic_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_stats" (
	"article_id" bigint NOT NULL,
	"locale" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_stats_article_id_locale_day_pk" PRIMARY KEY("article_id","locale","day"),
	CONSTRAINT "article_stats_locale_ck" CHECK (locale IN ('en', 'id'))
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirm_token_hash" text,
	"confirm_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "subscriber_status_ck" CHECK (status IN ('pending', 'confirmed', 'unsubscribed'))
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status" integer DEFAULT 301 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_status_ck" CHECK (status IN (301, 302, 308))
);
--> statement-breakpoint
ALTER TABLE "category_locales" ADD CONSTRAINT "category_locales_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_locales" ADD CONSTRAINT "topic_locales_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_locales" ADD CONSTRAINT "article_locales_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_articles" ADD CONSTRAINT "topic_articles_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_articles" ADD CONSTRAINT "topic_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_stats" ADD CONSTRAINT "article_stats_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_locales_slug_idx" ON "article_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "article_locales_published_idx" ON "article_locales" USING btree ("locale","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "article_tags_tag_idx" ON "article_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "topic_articles_article_idx" ON "topic_articles" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "article_stats_day_idx" ON "article_stats" USING btree ("day");--> statement-breakpoint
CREATE INDEX "newsletter_status_idx" ON "newsletter_subscribers" USING btree ("status");