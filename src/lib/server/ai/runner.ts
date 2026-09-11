import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { aiJobs } from '../db/schema';
import type { Database } from '../db/types';
import { serverEnv } from '../env';
import { fetchPublic } from '../media/fetch-url';
import { extractPage } from './extract';
import { createModelClient } from './llm';
import { runTask, type PipelineDeps, type Task } from './pipeline';
import { createSearchClient } from './search';
import { transitionJob } from './store';

/**
 * Runs writer jobs inside the web process, one at a time.
 *
 * No job queue service: the site has one editor and a 1-core VPS, and a job
 * is mostly waiting on a provider. The database row is the source of truth —
 * this module only decides what runs next — so a restart loses nothing but
 * the job that was mid-flight, which is marked failed rather than left
 * spinning forever.
 */

const MAX_PAGE_BYTES = 5 * 1024 * 1024;

export function defaultDeps(database: Database = db): PipelineDeps {
	return {
		db: database,
		createModel: createModelClient,
		createSearch: createSearchClient,
		async fetchSource(url, signal) {
			const response = await fetchPublic(url, {
				accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
				maxBytes: MAX_PAGE_BYTES,
				noun: 'page',
				userAgent: 'VERUM/1.0 (+editor-initiated research)',
				signal,
				// Test fixtures only. Unset in every real environment.
				allowOrigin: serverEnv.AI_UNSAFE_TEST_SOURCE_ORIGIN || null
			});
			return {
				page: extractPage(response.buffer, response.contentType),
				finalUrl: response.url.href
			};
		},
		now: () => new Date()
	};
}

const queue: Task[] = [];
let running: { task: Task; controller: AbortController } | null = null;
let started = false;

export function enqueue(jobId: number, kind: Task['kind'] = 'run') {
	if (running?.task.jobId === jobId || queue.some((t) => t.jobId === jobId)) return;
	queue.push({ jobId, kind });
	void pump();
}

async function pump() {
	if (running) return;
	const task = queue.shift();
	if (!task) return;

	const controller = new AbortController();
	running = { task, controller };
	try {
		await runTask(defaultDeps(), task, controller.signal);
	} finally {
		running = null;
		void pump();
	}
}

export async function cancelJob(database: Database, jobId: number): Promise<boolean> {
	const moved = await transitionJob(
		database,
		jobId,
		['queued', 'researching', 'review', 'drafting'],
		'cancelled',
		{ finishedAt: new Date() }
	);
	const index = queue.findIndex((t) => t.jobId === jobId);
	if (index !== -1) queue.splice(index, 1);
	if (running?.task.jobId === jobId) running.controller.abort();
	return moved;
}

export function isRunning(jobId: number): boolean {
	return running?.task.jobId === jobId;
}

/**
 * Picks up where a restart left off. Called from the writer's pages rather
 * than at boot, so a process that never serves the admin never touches the
 * table.
 */
export async function resumeJobs(database: Database = db) {
	if (started) return;
	started = true;

	// Research writes source rows as it goes; re-running it half-way would
	// collide with them. Failing it is honest, and a new job is one click.
	await database
		.update(aiJobs)
		.set({
			status: 'failed',
			error: 'Interrupted by a server restart. Start it again.',
			finishedAt: new Date()
		})
		.where(inArray(aiJobs.status, ['researching']));

	const pending = await database
		.select({ id: aiJobs.id })
		.from(aiJobs)
		.where(inArray(aiJobs.status, ['queued', 'drafting']))
		.orderBy(aiJobs.id);
	pending.forEach((row) => enqueue(row.id));
}
