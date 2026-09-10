<script lang="ts">
	import StaticPageBody from '$lib/components/StaticPageBody.svelte';

	let { data } = $props();
</script>

<StaticPageBody seo={data.seo} title={data.title} html={data.html} />
