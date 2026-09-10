import { fail, type Actions } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { redirects } from '$lib/server/db/schema';
import { listRedirects } from '$lib/server/db/queries/admin';
import { redirectSchema } from '$lib/server/content/schemas';
import type { PageServerLoad } from './$types';

const adapter = valibot(redirectSchema);

const PER_PAGE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
	const { items, total } = await listRedirects(db, {
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE
	});

	return {
		redirects: items,
		page,
		total,
		pages: Math.max(1, Math.ceil(total / PER_PAGE)),
		form: await superValidate({ status: 301 as const }, adapter)
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { fromPath, toPath, status } = form.data;

		// Refuse a rule whose target is itself a redirect source: that is a chain,
		// and each hop dilutes what the 301 passes on.
		const [chained] = await db.execute<{ to_path: string }>(
			sql`SELECT to_path FROM redirects WHERE from_path = ${toPath} LIMIT 1`
		);
		if (chained) {
			form.errors.toPath = [
				`${toPath} already redirects to ${chained.to_path}. Point there instead.`
			];
			return message(form, 'That would create a redirect chain.', { status: 400 });
		}

		await db
			.insert(redirects)
			.values({ fromPath, toPath, status })
			.onConflictDoUpdate({ target: redirects.fromPath, set: { toPath, status } });

		return message(form, `Saved ${fromPath} → ${toPath}.`);
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });

		await db.delete(redirects).where(eq(redirects.id, id));
		return { deleted: true };
	}
};
