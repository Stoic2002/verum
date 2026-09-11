/**
 * Server-sent events as the chat APIs send them: `data:` lines, events
 * separated by a blank line, `:` lines as keep-alive comments. Yields each
 * event's data. Chunk boundaries fall anywhere — mid-line, mid-JSON — so
 * nothing is parsed until a line is complete.
 */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let data: string[] = [];

	const takeLine = (line: string): string | null => {
		if (line === '') {
			const event = data.length ? data.join('\n') : null;
			data = [];
			return event;
		}
		if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
		return null;
	};

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let newline = buffer.indexOf('\n');
			while (newline !== -1) {
				const event = takeLine(buffer.slice(0, newline).replace(/\r$/, ''));
				buffer = buffer.slice(newline + 1);
				if (event !== null) yield event;
				newline = buffer.indexOf('\n');
			}
		}

		buffer += decoder.decode();
		if (buffer) takeLine(buffer.replace(/\r$/, ''));
		const last = takeLine('');
		if (last !== null) yield last;
	} finally {
		// Closes the connection when the caller stops early (a [DONE] event).
		await reader.cancel().catch(() => {});
	}
}
