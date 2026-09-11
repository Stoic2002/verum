import { fail, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { categories, categoryLocales, tags } from '$lib/server/db/schema';
import { listCategoriesForAdmin, listTagsForAdmin } from '$lib/server/db/queries/admin';
import { categorySchema, tagSchema } from '$lib/server/content/schemas';
import type { PageServerLoad } from './$types';

const categoryAdapter = valibot(categorySchema);
const tagAdapter = valibot(tagSchema);

export const load: PageServerLoad = async () => ({
	categories: await listCategoriesForAdmin(db),
	tags: await listTagsForAdmin(db),
	// errors: false — initial values are not a submission, so nothing is "Required" yet.
	categoryForm: await superValidate({ isActive: true, sortOrder: 0 }, categoryAdapter, {
		errors: false
	}),
	tagForm: await superValidate(tagAdapter)
});

export const actions: Actions = {
	saveCategory: async ({ request }) => {
		const form = await superValidate(request, categoryAdapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { slug, isActive, sortOrder, nameEn, nameId, descriptionEn, descriptionId } = form.data;

		await db.transaction(async (tx) => {
			const [category] = await tx
				.insert(categories)
				.values({ slug, isActive, sortOrder })
				.onConflictDoUpdate({ target: categories.slug, set: { isActive, sortOrder } })
				.returning({ id: categories.id });

			const rows = [
				{ locale: 'en' as const, name: nameEn, description: descriptionEn },
				{ locale: 'id' as const, name: nameId || nameEn, description: descriptionId }
			];

			for (const row of rows) {
				await tx
					.insert(categoryLocales)
					.values({
						categoryId: category.id,
						locale: row.locale,
						name: row.name,
						// Original prose or nothing — a boilerplate description is a
						// thin page pretending to be a real one (PRD §8.1).
						description: row.description || null
					})
					.onConflictDoUpdate({
						target: [categoryLocales.categoryId, categoryLocales.locale],
						set: { name: row.name, description: row.description || null }
					});
			}
		});

		return message(form, `Saved category “${slug}”.`);
	},

	saveTag: async ({ request }) => {
		const form = await superValidate(request, tagAdapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { slug, name } = form.data;
		await db
			.insert(tags)
			.values({ slug, name })
			.onConflictDoUpdate({ target: tags.slug, set: { name } });

		return message(form, `Saved tag “${name}”.`);
	},

	deleteTag: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });

		// article_tags cascades; the articles themselves are untouched.
		await db.delete(tags).where(eq(tags.id, id));
		return { toast: 'Tag deleted. The articles that carried it are unchanged.' };
	}
};
