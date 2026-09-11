<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/forms.css';
	import { enhance } from '$app/forms';
	import { Button, Field, Toaster } from '$lib/components/ui';
	import { toast } from '$lib/toast.svelte';

	let { data, form } = $props();
	let submitting = $state(false);

	let shownFlash = '';
	$effect(() => {
		if (data.flash && data.flash.id !== shownFlash) {
			shownFlash = data.flash.id;
			toast(data.flash.type, data.flash.message);
		}
	});
</script>

<svelte:head><title>Sign in · VERUM</title></svelte:head>

<main>
	<h1>VERUM</h1>
	<p class="sub">Editor sign-in</p>

	<form
		class="form-grid"
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<input type="hidden" name="next" value={data.next} />

		<Field id="email" label="Username or email">
			{#snippet children({ id, describedBy })}
				<!--
					type="text", not type="email": the browser would otherwise refuse
					to submit a bare username as an invalid address.
				-->
				<input
					{id}
					name="email"
					type="text"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
					autocomplete="username"
					required
					aria-describedby={describedBy}
					value={form?.email ?? ''}
				/>
			{/snippet}
		</Field>

		<Field id="password" label="Password">
			{#snippet children({ id, describedBy })}
				<input
					{id}
					name="password"
					type="password"
					autocomplete="current-password"
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>

		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}

		<Button type="submit" loading={submitting} loadingLabel="Signing in…">Sign in</Button>
	</form>
</main>

<Toaster />

<style>
	main {
		max-width: 21rem;
		margin: 14vh auto;
		padding: 0 1.5rem;
		color: var(--text);
	}
	h1 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.25rem;
		letter-spacing: 0.16em;
	}
	h1::before {
		content: '';
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		background: var(--accent);
	}
	.sub {
		margin: 0.375rem 0 2rem;
		color: var(--text-3);
		font-size: 0.875rem;
	}
	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.8125rem;
	}
	:global(body) {
		background: var(--bg);
	}
</style>
