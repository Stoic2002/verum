ALTER TABLE "ai_credentials" DROP CONSTRAINT "ai_credentials_kind_ck";--> statement-breakpoint
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_kind_ck" CHECK ((purpose = 'model' AND kind IN ('anthropic', 'openai', 'gemini', 'openrouter', 'openai_compatible', 'anthropic_compatible'))
				OR (purpose = 'search' AND kind IN ('brave', 'tavily')));