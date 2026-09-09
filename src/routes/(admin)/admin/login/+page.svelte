<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · VERUM</title></svelte:head>

<main>
	<h1>VERUM</h1>
	<p class="sub">Editor sign-in</p>

	<form
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

		<label for="email">Email</label>
		<input
			id="email"
			name="email"
			type="email"
			autocomplete="username"
			required
			value={form?.email ?? ''}
		/>

		<label for="password">Password</label>
		<input id="password" name="password" type="password" autocomplete="current-password" required />

		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}

		<button type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</main>

<style>
	main {
		max-width: 22rem;
		margin: 12vh auto;
		padding: 0 1.5rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: 0.08em;
	}
	.sub {
		margin: 0.25rem 0 2rem;
		color: #666;
		font-size: 0.875rem;
	}
	form {
		display: grid;
		gap: 0.375rem;
	}
	label {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	label + input {
		margin-bottom: 0.75rem;
	}
	input {
		padding: 0.5rem 0.625rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
	}
	button {
		margin-top: 0.5rem;
		padding: 0.5rem;
		border: 0;
		border-radius: 4px;
		background: #111;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.error {
		margin: 0.25rem 0 0;
		color: #b00020;
		font-size: 0.8125rem;
	}
</style>
