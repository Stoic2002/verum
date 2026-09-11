import * as v from 'valibot';
import { QUALITY_GATE_KEYS } from '../../quality-gate';
import { ARTICLE_STATUSES, LOCALES } from '../db/schema';

/**
 * One schema per form, shared by the server action and the client.
 *
 * Superforms validates on both sides from these, so a rule cannot drift
 * between what the browser enforces and what the database is protected by.
 */

const trimmed = (max: number) =>
	v.pipe(v.string(), v.trim(), v.minLength(1, 'Required'), v.maxLength(max));

/** Lowercase, hyphenated, no leading or trailing hyphen. */
export const slugSchema = v.pipe(
	v.string(),
	v.trim(),
	v.toLowerCase(),
	v.minLength(1, 'Required'),
	v.maxLength(80),
	v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and single hyphens only')
);

export const localeSchema = v.picklist(LOCALES);

export const articleLocaleSchema = v.object({
	slug: slugSchema,
	title: trimmed(160),
	excerpt: trimmed(400),
	bodyMd: v.pipe(v.string(), v.maxLength(400_000)),
	// PRD §12.2 caps these; the editor shows a live count rather than truncating.
	metaTitle: v.pipe(v.string(), v.trim(), v.maxLength(60)),
	metaDesc: v.pipe(v.string(), v.trim(), v.maxLength(155)),
	correction: v.pipe(v.string(), v.trim(), v.maxLength(2000))
});

export const newArticleSchema = v.object({
	categoryId: v.pipe(v.number(), v.integer(), v.minValue(1, 'Choose a category')),
	locale: localeSchema,
	title: trimmed(160),
	slug: slugSchema
});

export const articleSettingsSchema = v.object({
	categoryId: v.pipe(v.number(), v.integer(), v.minValue(1)),
	/** 0 means no cover image. */
	coverMediaId: v.pipe(v.number(), v.integer(), v.minValue(0)),
	status: v.picklist(ARTICLE_STATUSES),
	isLiving: v.boolean(),
	/** Local datetime string from <input type="datetime-local">; empty means now. */
	publishAt: v.pipe(v.string(), v.trim()),
	tagIds: v.array(v.pipe(v.number(), v.integer())),
	/** PRD §5.5 confirmations. Checked when the article goes live, never stored. */
	qualityGate: v.optional(v.array(v.picklist(QUALITY_GATE_KEYS)), [])
});

export const categorySchema = v.object({
	slug: slugSchema,
	isActive: v.boolean(),
	sortOrder: v.pipe(v.number(), v.integer()),
	nameEn: trimmed(80),
	nameId: v.pipe(v.string(), v.trim(), v.maxLength(80)),
	descriptionEn: v.pipe(v.string(), v.trim(), v.maxLength(500)),
	descriptionId: v.pipe(v.string(), v.trim(), v.maxLength(500))
});

export const tagSchema = v.object({
	slug: slugSchema,
	name: trimmed(60)
});

const pathSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, 'Required'),
	v.maxLength(500),
	v.regex(/^\/(?!\/)/, 'Must be a site-relative path starting with /')
);

export const redirectSchema = v.pipe(
	v.object({
		fromPath: pathSchema,
		toPath: pathSchema,
		status: v.picklist([301, 302, 308])
	}),
	v.forward(
		v.check(({ fromPath, toPath }) => fromPath !== toPath, 'A path cannot redirect to itself'),
		['toPath']
	)
);
