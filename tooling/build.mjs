#!/usr/bin/env node
// Usage:
//   node tooling/build.mjs                 validate and write dist/
//   node tooling/build.mjs --check         validate only
//   node tooling/build.mjs --previous <index.json>
//                                          also fail on missing version bumps, and
//                                          write dist/unchanged when nothing new would ship
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveName, buildIndex, buildTarGz, checkVersionBumps, loadLibrary, sameContent } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const prevIdx = args.indexOf('--previous');
const previousPath = prevIdx >= 0 ? args[prevIdx + 1] : undefined;

async function main() {
	const items = await loadLibrary(path.join(root, 'skills'));
	const archives = new Map(items.map((it) => [it.id, buildTarGz(it.files)]));
	const index = buildIndex(items, archives, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));

	let previous;
	if (previousPath) {
		try {
			previous = JSON.parse(await fs.readFile(previousPath, 'utf8'));
		} catch (err) {
			if (err.code !== 'ENOENT') {
				throw err;
			}
			console.log(`No previous index at ${previousPath}; skipping version bump check.`);
		}
		const bumpErrors = checkVersionBumps(previous, index);
		if (bumpErrors.length > 0) {
			throw Object.assign(new Error(bumpErrors.join('\n')), { errors: bumpErrors });
		}
	}

	for (const it of items) {
		const flags = it.hasScripts ? ' [scripts]' : '';
		console.log(`ok  ${it.id}@${it.version}  ${it.files.size} files${flags}`);
	}
	if (checkOnly) {
		console.log(`${items.length} skills valid.`);
		return;
	}

	const dist = path.join(root, 'dist');
	await fs.rm(dist, { recursive: true, force: true });
	await fs.mkdir(dist, { recursive: true });
	for (const it of items) {
		await fs.writeFile(path.join(dist, archiveName(it.id, it.version)), archives.get(it.id));
	}
	await fs.writeFile(path.join(dist, 'index.json'), JSON.stringify(index, null, 2) + '\n');
	await fs.writeFile(path.join(dist, 'release-notes.md'), releaseNotes(previous, index));
	if (sameContent(previous, index)) {
		await fs.writeFile(path.join(dist, 'unchanged'), '');
		console.log('No content changes since the previous release.');
	}
	console.log(`Wrote ${items.length} archives and index.json to dist/.`);
}

function releaseNotes(previous, index) {
	const prev = new Map((previous?.items ?? []).map((it) => [it.id, it.latest]));
	const lines = [];
	for (const it of index.items) {
		const before = prev.get(it.id);
		if (!before) {
			lines.push(`- New: ${it.id} ${it.latest}`);
		} else if (before !== it.latest) {
			lines.push(`- Updated: ${it.id} ${before} to ${it.latest}`);
		}
		prev.delete(it.id);
	}
	for (const id of prev.keys()) {
		lines.push(`- Removed: ${id}`);
	}
	if (lines.length === 0) {
		lines.push('- Metadata changes only.');
	}
	return `${lines.join('\n')}\n\n${index.items.length} skills in this release.\n`;
}

main().catch((err) => {
	console.error(err.errors ? `Validation failed:\n  ${err.errors.join('\n  ')}` : err.stack ?? String(err));
	process.exit(1);
});
