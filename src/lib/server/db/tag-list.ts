import * as v from 'valibot';
import { slugify } from '../../slug';
import { tagSchema } from '../content/schemas';

/**
 * Starter tags, loaded with `bun run db:seed-tags`.
 *
 * Additive only: the seed never deletes a tag or renames one the editor chose,
 * so it is safe to run again after this list grows. A tag with fewer than three
 * articles is noindexed and left out of the sitemap (PRD §12.7), so an unused
 * tag here costs nothing in search.
 *
 * Slugs are explicit wherever the generated one would be wrong or would
 * collide — "C++" and "C#" both slugify to "c".
 */
export type TagSeed = { name: string; slug?: string };

export const TAG_GROUPS: Record<string, TagSeed[]> = {
	'AI companies': [
		{ name: 'OpenAI' },
		{ name: 'Anthropic' },
		{ name: 'Google DeepMind' },
		{ name: 'Meta AI' },
		{ name: 'Microsoft' },
		{ name: 'xAI', slug: 'xai' },
		{ name: 'Mistral AI' },
		{ name: 'DeepSeek' },
		{ name: 'Alibaba Cloud' },
		{ name: 'Moonshot AI' },
		{ name: 'Z.ai', slug: 'zai' },
		{ name: 'MiniMax' },
		{ name: 'Perplexity' },
		{ name: 'Hugging Face' },
		{ name: 'Nvidia' },
		{ name: 'Cohere' },
		{ name: 'Stability AI' },
		{ name: 'ElevenLabs' },
		{ name: 'Runway' }
	],
	'AI products and models': [
		{ name: 'ChatGPT' },
		{ name: 'GPT', slug: 'gpt' },
		{ name: 'Claude' },
		{ name: 'Claude Code' },
		{ name: 'Gemini' },
		{ name: 'Grok' },
		{ name: 'Llama' },
		{ name: 'Qwen' },
		{ name: 'Kimi' },
		{ name: 'GLM', slug: 'glm' },
		{ name: 'Codex' },
		{ name: 'GitHub Copilot' },
		{ name: 'Microsoft Copilot' },
		{ name: 'Cursor' },
		{ name: 'Windsurf' },
		{ name: 'Gemini CLI' },
		{ name: 'NotebookLM', slug: 'notebooklm' },
		{ name: 'Midjourney' },
		{ name: 'Stable Diffusion' },
		{ name: 'Flux' },
		{ name: 'Sora' },
		{ name: 'Veo' },
		{ name: 'Suno' },
		{ name: 'Apple Intelligence' }
	],
	'AI concepts': [
		{ name: 'LLM', slug: 'llm' },
		{ name: 'AI Agents' },
		{ name: 'AI Coding' },
		{ name: 'Prompt Engineering' },
		{ name: 'RAG', slug: 'rag' },
		{ name: 'Open Models' },
		{ name: 'Local AI' },
		{ name: 'Multimodal AI' },
		{ name: 'Reasoning Models' },
		{ name: 'Image Generation' },
		{ name: 'Video Generation' },
		{ name: 'Voice AI' },
		{ name: 'Computer Use' },
		{ name: 'MCP', slug: 'mcp' },
		{ name: 'Fine-Tuning' },
		{ name: 'Embeddings' },
		{ name: 'Vector Databases' },
		{ name: 'Context Window' },
		{ name: 'AI Benchmarks' },
		{ name: 'AI Pricing' },
		{ name: 'AI Safety' },
		{ name: 'AGI', slug: 'agi' },
		{ name: 'AI Search' },
		{ name: 'Chatbots' },
		{ name: 'Automation' },
		{ name: 'No-Code' }
	],
	'Languages and frameworks': [
		{ name: 'JavaScript' },
		{ name: 'TypeScript' },
		{ name: 'Python' },
		{ name: 'Rust' },
		{ name: 'Go', slug: 'golang' },
		{ name: 'Java' },
		{ name: 'Kotlin' },
		{ name: 'Swift' },
		{ name: 'PHP', slug: 'php' },
		{ name: 'C++', slug: 'cpp' },
		{ name: 'C#', slug: 'csharp' },
		{ name: 'Svelte' },
		{ name: 'SvelteKit' },
		{ name: 'React' },
		{ name: 'Next.js', slug: 'nextjs' },
		{ name: 'Vue', slug: 'vue' },
		{ name: 'Nuxt' },
		{ name: 'Angular' },
		{ name: 'Astro' },
		{ name: 'Tailwind CSS' },
		{ name: 'Node.js', slug: 'nodejs' },
		{ name: 'Bun' },
		{ name: 'Deno' },
		{ name: 'Laravel' },
		{ name: 'Django' },
		{ name: 'FastAPI', slug: 'fastapi' },
		{ name: 'Flutter' },
		{ name: 'React Native' }
	],
	'Developer tools and infrastructure': [
		{ name: 'Developer Tools' },
		{ name: 'Web Development' },
		{ name: 'Frontend' },
		{ name: 'Backend' },
		{ name: 'Mobile Development' },
		{ name: 'Open Source' },
		{ name: 'Git' },
		{ name: 'GitHub' },
		{ name: 'VS Code', slug: 'vscode' },
		{ name: 'JetBrains' },
		{ name: 'Neovim' },
		{ name: 'Terminal' },
		{ name: 'Docker' },
		{ name: 'Kubernetes' },
		{ name: 'Linux' },
		{ name: 'Ubuntu' },
		{ name: 'Self-Hosting' },
		{ name: 'PostgreSQL', slug: 'postgresql' },
		{ name: 'SQLite', slug: 'sqlite' },
		{ name: 'Redis' },
		{ name: 'Databases' },
		{ name: 'Supabase' },
		{ name: 'Firebase' },
		{ name: 'Cloudflare' },
		{ name: 'Vercel' },
		{ name: 'AWS', slug: 'aws' },
		{ name: 'Google Cloud' },
		{ name: 'Azure' },
		{ name: 'Serverless' },
		{ name: 'DevOps' },
		{ name: 'CI/CD', slug: 'ci-cd' },
		{ name: 'Testing' },
		{ name: 'APIs', slug: 'apis' },
		{ name: 'Web Performance' }
	],
	'Security and privacy': [
		{ name: 'Cybersecurity' },
		{ name: 'Privacy' },
		{ name: 'Vulnerabilities' },
		{ name: 'Malware' },
		{ name: 'Passkeys' }
	],
	'Devices and platforms': [
		{ name: 'Gadgets' },
		{ name: 'Smartphones' },
		{ name: 'Android' },
		{ name: 'iPhone', slug: 'iphone' },
		{ name: 'iOS', slug: 'ios' },
		{ name: 'macOS', slug: 'macos' },
		{ name: 'Windows' },
		{ name: 'Laptops' },
		{ name: 'Tablets' },
		{ name: 'Wearables' },
		{ name: 'Smart Home' },
		{ name: 'VR and AR', slug: 'vr-ar' },
		{ name: 'Apple' },
		{ name: 'Google' },
		{ name: 'Samsung' },
		{ name: 'Xiaomi' },
		{ name: 'Google Pixel' },
		{ name: 'Chips' },
		{ name: 'AMD', slug: 'amd' },
		{ name: 'Intel' },
		{ name: 'Qualcomm' },
		{ name: 'Apple Silicon' }
	],
	'Apps and internet': [
		{ name: 'YouTube' },
		{ name: 'TikTok' },
		{ name: 'Instagram' },
		{ name: 'WhatsApp' },
		{ name: 'X (Twitter)', slug: 'x-twitter' },
		{ name: 'Social Media' },
		{ name: 'Productivity' },
		{ name: 'Startups' },
		{ name: 'E-commerce' },
		{ name: 'Indonesia' }
	],
	'Games and esports': [
		{ name: 'Gaming' },
		{ name: 'Esports' },
		{ name: 'PC Gaming' },
		{ name: 'Mobile Gaming' },
		{ name: 'PlayStation' },
		{ name: 'Xbox' },
		{ name: 'Nintendo' },
		{ name: 'Steam' },
		{ name: 'Game Development' },
		{ name: 'Unity' },
		{ name: 'Unreal Engine' },
		{ name: 'Dota 2' },
		{ name: 'Mobile Legends' },
		{ name: 'Valorant' },
		{ name: 'Counter-Strike 2' },
		{ name: 'League of Legends' },
		{ name: 'PUBG Mobile', slug: 'pubg-mobile' },
		{ name: 'Free Fire' },
		{ name: 'Genshin Impact' },
		{ name: 'Honkai: Star Rail' },
		{ name: 'Minecraft' },
		{ name: 'Roblox' },
		{ name: 'GTA VI', slug: 'gta-6' }
	],
	Entertainment: [
		{ name: 'K-Drama' },
		{ name: 'K-Pop' },
		{ name: 'Anime' },
		{ name: 'Netflix' },
		{ name: 'Streaming' },
		{ name: 'Spotify' }
	],
	Formats: [{ name: 'Comparison' }, { name: 'Guide' }, { name: 'Explainer' }]
};

/**
 * The list as rows to insert, validated by the same schema as the admin form.
 * Throws on a duplicate slug rather than letting the second silently win.
 */
export function resolveTags(): { slug: string; name: string }[] {
	const seen = new Map<string, string>();
	const rows: { slug: string; name: string }[] = [];

	for (const seed of Object.values(TAG_GROUPS).flat()) {
		const row = v.parse(tagSchema, { name: seed.name, slug: seed.slug ?? slugify(seed.name) });
		const clash = seen.get(row.slug);
		if (clash) throw new Error(`"${seed.name}" and "${clash}" share the slug "${row.slug}"`);
		seen.set(row.slug, seed.name);
		rows.push(row);
	}
	return rows;
}
