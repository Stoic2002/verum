-- Full-text search vector for article_locales.
--
-- A trigger rather than a generated column: a generated column must call an
-- IMMUTABLE expression, which rules out choosing the text search config from
-- the row's own locale. English and Indonesian stem very differently
-- ('comparing' -> 'compar', 'perbandingan' -> 'banding'), so one shared config
-- would degrade both.
--
-- Weights follow how much a match in each field should count:
--   A title · B excerpt · C body

CREATE OR REPLACE FUNCTION article_locales_search_vector() RETURNS trigger AS $$
DECLARE
	cfg regconfig;
	body text;
BEGIN
	cfg := CASE NEW.locale WHEN 'id' THEN 'indonesian' ELSE 'english' END::regconfig;

	-- body_text is plain prose produced by the render pipeline. Until Fase 3
	-- fills it, fall back to the raw markdown so search is never silently empty.
	body := coalesce(nullif(NEW.body_text, ''), NEW.body_md, '');

	NEW.search_vector :=
		setweight(to_tsvector(cfg, coalesce(NEW.title, '')), 'A') ||
		setweight(to_tsvector(cfg, coalesce(NEW.excerpt, '')), 'B') ||
		setweight(to_tsvector(cfg, body), 'C');

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER article_locales_search_vector_tg
	BEFORE INSERT OR UPDATE OF locale, title, excerpt, body_text, body_md
	ON article_locales
	FOR EACH ROW
	EXECUTE FUNCTION article_locales_search_vector();
--> statement-breakpoint

CREATE INDEX article_locales_search_idx ON article_locales USING gin (search_vector);
