/**
 * Renders the PNG icons from the one SVG mark.
 *
 *   bun run icons
 *
 * Two files, for the two places an SVG is not enough: Safari's home-screen
 * icon, and the square image link previews fall back to. Both are full-bleed —
 * iOS applies its own rounded mask, and a rounded source inside that mask
 * leaves a pale halo at the corners.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<defs>
		<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#2E6BE0"/>
			<stop offset="1" stop-color="#1246A5"/>
		</linearGradient>
	</defs>
	<rect width="64" height="64" fill="url(#v)"/>
	<path d="M13 16h13l6 23.5L38 16h13L32 50Z" fill="#fff"/>
</svg>`;

const OUT = 'static';
await mkdir(OUT, { recursive: true });

for (const [name, size] of [
	['apple-touch-icon.png', 180],
	['icon-512.png', 512]
] as const) {
	const png = await sharp(Buffer.from(MARK), { density: 384 })
		.resize(size, size, { fit: 'fill' })
		.png({ compressionLevel: 9 })
		.toBuffer();
	await writeFile(`${OUT}/${name}`, png);
	console.log(`${OUT}/${name} — ${size}x${size}, ${(png.length / 1024).toFixed(1)} KB`);
}
