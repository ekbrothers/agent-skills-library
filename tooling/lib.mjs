// Build and validation logic for the skills library. No dependencies beyond Node.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const INDEX_SCHEMA_VERSION = 1;
export const TOOL_IDS = ['claude', 'copilot', 'cortex'];
/** Per-item metadata file. Read by the build, never shipped in the archive. */
export const ITEM_FILE = 'item.json';
export const MAX_ITEM_BYTES = 1024 * 1024;

const ITEM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// Em-dash, en-dash and the main emoji blocks. House style bans them in item content.
const BANNED_CHARS = /[\u2013\u2014\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

export function sha256(data) {
	return createHash('sha256').update(data).digest('hex');
}

export function isValidItemId(id) {
	return typeof id === 'string' && id.length <= 64 && ITEM_ID.test(id);
}

export function compareSemver(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) {
			return pa[i] < pb[i] ? -1 : 1;
		}
	}
	return 0;
}

/**
 * Parses the top-level keys of SKILL.md frontmatter. Handles plain scalars,
 * quoted scalars and folded or literal blocks. Nested values are kept as raw text.
 */
export function parseFrontmatter(text) {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	if (lines[0] !== '---') {
		throw new Error('SKILL.md must start with a "---" frontmatter line.');
	}
	const end = lines.indexOf('---', 1);
	if (end === -1) {
		throw new Error('SKILL.md frontmatter is not closed with "---".');
	}
	const fields = {};
	let i = 1;
	while (i < end) {
		const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
		if (!m) {
			i++;
			continue;
		}
		const [, key, rawValue] = m;
		const block = [];
		i++;
		while (i < end && (lines[i] === '' || /^\s/.test(lines[i]) || lines[i].startsWith('- '))) {
			block.push(lines[i]);
			i++;
		}
		let value = rawValue.trim();
		if (value === '>' || value === '|') {
			const parts = block.map((l) => l.trim());
			value = value === '>' ? parts.filter(Boolean).join(' ') : parts.join('\n').trim();
		} else if (value === '' && block.length > 0) {
			value = block.join('\n');
		} else if (/^(["']).*\1$/.test(value)) {
			value = value.slice(1, -1);
		}
		fields[key] = value;
	}
	return { fields, body: lines.slice(end + 1).join('\n') };
}

/** Lists regular files under dir as sorted POSIX relative paths. Rejects symlinks. */
export async function listFiles(dir) {
	const out = [];
	async function walk(current, prefix) {
		for (const e of await fs.readdir(current, { withFileTypes: true })) {
			const rel = prefix ? `${prefix}/${e.name}` : e.name;
			if (e.isSymbolicLink()) {
				throw new Error(`symbolic links are not allowed (${rel})`);
			} else if (e.isDirectory()) {
				await walk(path.join(current, e.name), rel);
			} else if (e.isFile()) {
				out.push(rel);
			}
		}
	}
	await walk(dir, '');
	return out.sort();
}

/**
 * Loads and validates one skill folder. Returns the item plus the files to ship,
 * or throws with every problem found, not just the first.
 */
export async function loadItem(skillDir) {
	const id = path.basename(skillDir);
	const errors = [];
	const fail = (msg) => errors.push(`${id}: ${msg}`);

	if (!isValidItemId(id)) {
		fail('folder name must be lowercase letters, digits and single hyphens, up to 64 characters');
	}

	let all = [];
	try {
		all = await listFiles(skillDir);
	} catch (err) {
		fail(err.message);
	}
	for (const f of all) {
		if (f.split('/').some((part) => part.startsWith('.'))) {
			fail(`hidden files are not allowed (${f})`);
		}
	}
	const shipped = all.filter((f) => f !== ITEM_FILE);

	let meta = {};
	if (!all.includes(ITEM_FILE)) {
		fail(`missing ${ITEM_FILE}`);
	} else {
		try {
			meta = JSON.parse(await fs.readFile(path.join(skillDir, ITEM_FILE), 'utf8'));
		} catch (err) {
			fail(`${ITEM_FILE} is not valid JSON: ${err.message}`);
		}
	}
	if (typeof meta.version !== 'string' || !SEMVER.test(meta.version)) {
		fail(`${ITEM_FILE} "version" must be MAJOR.MINOR.PATCH`);
	}
	if (typeof meta.title !== 'string' || meta.title.trim() === '') {
		fail(`${ITEM_FILE} "title" is required`);
	}
	if (typeof meta.summary !== 'string' || meta.summary.trim() === '' || meta.summary.length > 120) {
		fail(`${ITEM_FILE} "summary" is required and must be at most 120 characters`);
	}
	const tools = meta.tools ?? TOOL_IDS;
	if (!Array.isArray(tools) || tools.length === 0 || tools.some((t) => !TOOL_IDS.includes(t))) {
		fail(`${ITEM_FILE} "tools" must be a non-empty subset of ${TOOL_IDS.join(', ')}`);
	}

	const files = new Map();
	let total = 0;
	for (const f of shipped) {
		const data = await fs.readFile(path.join(skillDir, ...f.split('/')));
		total += data.length;
		files.set(f, data);
		if (BANNED_CHARS.test(data.toString('utf8'))) {
			fail(`${f} contains an em-dash, en-dash or emoji`);
		}
	}
	if (total > MAX_ITEM_BYTES) {
		fail(`item is ${total} bytes; the limit is ${MAX_ITEM_BYTES}`);
	}

	if (!files.has('SKILL.md')) {
		fail('missing SKILL.md');
	} else {
		try {
			const { fields, body } = parseFrontmatter(files.get('SKILL.md').toString('utf8'));
			if (fields.name !== id) {
				fail(`frontmatter "name" must equal the folder name "${id}" (got "${fields.name ?? ''}")`);
			}
			if (!fields.description) {
				fail('frontmatter "description" is required');
			} else if (fields.description.length > 1024) {
				fail('frontmatter "description" must be at most 1024 characters');
			}
			if (body.trim() === '') {
				fail('SKILL.md has no body');
			}
		} catch (err) {
			fail(err.message);
		}
	}

	if (errors.length > 0) {
		const err = new Error(errors.join('\n'));
		err.errors = errors;
		throw err;
	}

	return {
		id,
		title: meta.title.trim(),
		summary: meta.summary.trim(),
		version: meta.version,
		tools: [...tools],
		files,
		hasScripts: shipped.some((f) => f.startsWith('scripts/')),
		contentHash: contentHash(files),
	};
}

/** Hash of the shipped tree, independent of archive bytes. Used to catch missing version bumps. */
export function contentHash(files) {
	const lines = [...files.keys()].sort().map((f) => `${f}\0${sha256(files.get(f))}\n`);
	return sha256(lines.join(''));
}

// ---------- deterministic tar.gz ----------

function writeString(buf, offset, length, value) {
	const bytes = Buffer.from(value, 'utf8');
	if (bytes.length > length) {
		throw new Error(`tar field too long: ${value}`);
	}
	bytes.copy(buf, offset);
}

function writeOctal(buf, offset, length, value) {
	writeString(buf, offset, length, value.toString(8).padStart(length - 1, '0') + '\0');
}

function tarHeader(name, size, mode) {
	const h = Buffer.alloc(512);
	let prefix = '';
	let base = name;
	if (Buffer.byteLength(name) > 100) {
		const cut = name.lastIndexOf('/', 155);
		if (cut <= 0 || Buffer.byteLength(name.slice(cut + 1)) > 100) {
			throw new Error(`path too long for tar: ${name}`);
		}
		prefix = name.slice(0, cut);
		base = name.slice(cut + 1);
	}
	writeString(h, 0, 100, base);
	writeOctal(h, 100, 8, mode);
	writeOctal(h, 108, 8, 0); // uid
	writeOctal(h, 116, 8, 0); // gid
	writeOctal(h, 124, 12, size);
	writeOctal(h, 136, 12, 0); // mtime: fixed for reproducible archives
	h.fill(0x20, 148, 156); // checksum placeholder
	writeString(h, 156, 1, '0');
	writeString(h, 257, 6, 'ustar\0');
	writeString(h, 263, 2, '00');
	writeString(h, 345, 155, prefix);
	let sum = 0;
	for (const b of h) {
		sum += b;
	}
	writeString(h, 148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
	return h;
}

/** Builds a gzip-compressed ustar archive. Same input gives the same bytes on every OS. */
export function buildTarGz(files) {
	const chunks = [];
	for (const name of [...files.keys()].sort()) {
		const data = files.get(name);
		chunks.push(tarHeader(name, data.length, name.startsWith('scripts/') ? 0o755 : 0o644), data);
		const pad = (512 - (data.length % 512)) % 512;
		if (pad) {
			chunks.push(Buffer.alloc(pad));
		}
	}
	chunks.push(Buffer.alloc(1024));
	const gz = zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
	gz[9] = 0xff; // gzip OS byte varies by platform; set to "unknown"
	return gz;
}

// ---------- index ----------

export function archiveName(id, version) {
	return `${id}-${version}.tar.gz`;
}

export function buildIndex(items, archives, generatedAt) {
	return {
		schemaVersion: INDEX_SCHEMA_VERSION,
		generatedAt,
		items: items.map((it) => ({
			id: it.id,
			type: 'skill',
			title: it.title,
			description: it.summary,
			latest: it.version,
			versions: {
				[it.version]: {
					archive: archiveName(it.id, it.version),
					sha256: sha256(archives.get(it.id)),
					contentHash: it.contentHash,
					hasScripts: it.hasScripts,
				},
			},
			tools: it.tools,
		})),
	};
}

/**
 * Compares a new index against the previous release.
 * Errors: content changed without a version bump, or a version went backwards.
 */
export function checkVersionBumps(previous, next) {
	const errors = [];
	const prevById = new Map((previous?.items ?? []).map((it) => [it.id, it]));
	for (const it of next.items) {
		const prev = prevById.get(it.id);
		if (!prev) {
			continue;
		}
		const order = compareSemver(it.latest, prev.latest);
		if (order < 0) {
			errors.push(`${it.id}: version ${it.latest} is lower than the released ${prev.latest}`);
		} else if (order === 0) {
			const before = prev.versions?.[prev.latest]?.contentHash;
			const after = it.versions[it.latest].contentHash;
			if (before && before !== after) {
				errors.push(`${it.id}: content changed but version is still ${it.latest}; bump it in ${ITEM_FILE}`);
			}
		}
	}
	return errors;
}

/** True when the release would ship nothing new: same items, versions and content. */
export function sameContent(previous, next) {
	if (!previous) {
		return false;
	}
	const key = (idx) =>
		idx.items
			.map((it) => `${it.id}@${it.latest}:${it.versions[it.latest]?.contentHash}:${[...it.tools].sort().join(',')}:${it.title}:${it.description}`)
			.sort()
			.join('\n');
	return key(previous) === key(next);
}

/** Loads every skill under skillsRoot. Collects all validation errors before throwing. */
export async function loadLibrary(skillsRoot) {
	const entries = (await fs.readdir(skillsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
	const items = [];
	const errors = [];
	for (const name of entries) {
		try {
			items.push(await loadItem(path.join(skillsRoot, name)));
		} catch (err) {
			errors.push(...(err.errors ?? [err.message]));
		}
	}
	if (errors.length > 0) {
		const err = new Error(errors.join('\n'));
		err.errors = errors;
		throw err;
	}
	return items;
}
