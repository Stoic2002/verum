import sharp from 'sharp';

/**
 * Generates placeholder photographs for the demo dataset.
 *
 * Drawn rather than downloaded: the demo has to work offline, and PRD §14
 * limits real images to clearly licensed stock. These are obviously synthetic
 * so nobody mistakes one for a real asset that shipped.
 */

const PALETTES = [
	['#1d4ed8', '#7dd3fc'],
	['#0f766e', '#5eead4'],
	['#7c2d12', '#fdba74'],
	['#4c1d95', '#c4b5fd'],
	['#831843', '#f9a8d4'],
	['#134e4a', '#99f6e4']
];

/** A soft gradient with a grid over it, so cropping and srcset are visible. */
export async function demoImage(seed: number, width = 2400, height = 1350): Promise<Buffer> {
	const [from, to] = PALETTES[seed % PALETTES.length];
	const angle = (seed * 37) % 360;

	const lines = Array.from({ length: 9 }, (_, i) => {
		const x = ((i + 1) * width) / 10;
		return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>`;
	}).join('');

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<defs>
			<linearGradient id="g" gradientTransform="rotate(${angle})">
				<stop offset="0%" stop-color="${from}"/>
				<stop offset="100%" stop-color="${to}"/>
			</linearGradient>
		</defs>
		<rect width="${width}" height="${height}" fill="url(#g)"/>
		${lines}
		<circle cx="${width * 0.72}" cy="${height * 0.3}" r="${height * 0.28}" fill="#ffffff" fill-opacity="0.08"/>
		<text x="${width * 0.06}" y="${height * 0.88}" font-family="system-ui, sans-serif"
			font-size="${Math.round(height * 0.06)}" fill="#ffffff" fill-opacity="0.45">
			demo image ${seed}
		</text>
	</svg>`;

	// Rasterised to PNG so the upload path treats it like any other photo —
	// SVG is refused by processImage, and rightly so.
	return sharp(Buffer.from(svg)).png().toBuffer();
}
