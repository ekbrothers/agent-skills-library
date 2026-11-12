import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import {
	buildIndex,
	buildTarGz,
	checkVersionBumps,
	compareSemver,
	isValidItemId,
	loadItem,
	loadLibrary,
	parseFrontmatter,
	sameContent,
} from './lib.mjs';

const SKILL = (name) => `---\nname: ${name}\ndescription: Does a thing. Use when asked.\n---\n\n# Body\n`;
const META = { title: 'Demo', summary: 'Short summary.', version: '1.0.0', tools: ['claude', 'copilot', 'cortex'] };

let tmp;
async function makeSkill(name, files) {
	const dir = path.join(tmp, 'skills', name);
	for (const [rel, data] of Object.entries(files)) {
		const abs = path.join(dir, ...rel.split('/'));
		await fs.mkdir(path.dirname(abs), { recursive: true });
		await fs.writeFile(abs, data);
	}
	return dir;
}

before(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-lib-'));
});
after(async () => {
	await fs.rm(tmp, { recursive: true, force: true });
});

describe('basics', () => {
	test('item ids', () => {
		assert.ok(isValidItemId('data-quality-check'));
		for (const bad of ['', 'Data', 'a--b', '-a', 'a_b', '../x', 'x'.repeat(65)]) {
			assert.ok(!isValidItemId(bad), bad);
		}
	});

	test('semver compare', () => {
		assert.equal(compareSemver('1.2.0', '1.10.0'), -1);
		assert.equal(compareSemver('2.0.0', '1.99.99'), 1);
		assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
	});

	test('frontmatter: plain, quoted, folded, list', () => {
		const { fields, body } = parseFrontmatter(
			'---\nname: a\ndescription: >\n  line one\n  line two\nquoted: "x: y"\ntools:\n- read\n---\nbody',
		);
		assert.equal(fields.name, 'a');
		assert.equal(fields.description, 'line one line two');
		assert.equal(fields.quoted, 'x: y');
		assert.equal(fields.tools, '- read');
		assert.equal(body, 'body');
	});

	test('frontmatter must open and close', () => {
		assert.throws(() => parseFrontmatter('# no frontmatter'), /must start/);
		assert.throws(() => parseFrontmatter('---\nname: a\n'), /not closed/);
	});
});

describe('loadItem', () => {
	test('valid item ships everything but item.json', async () => {
		const dir = await makeSkill('ok-skill', {
			'SKILL.md': SKILL('ok-skill'),
			'item.json': JSON.stringify(META),
			'scripts/run.py': 'print(1)\n',
		});
		const item = await loadItem(dir);
		assert.deepEqual([...item.files.keys()], ['SKILL.md', 'scripts/run.py']);
		assert.equal(item.hasScripts, true);
		assert.equal(item.version, '1.0.0');
	});

	test('reports every problem at once', async () => {
		const dir = await makeSkill('bad-skill', {
			'SKILL.md': SKILL('other-name').replace('# Body', 'Uses an em\u2014dash'),
			'item.json': JSON.stringify({ ...META, version: '1.0', tools: ['vim'] }),
			'.hidden': 'x',
		});
		await assert.rejects(loadItem(dir), (err) => {
			const text = err.errors.join('\n');
			assert.match(text, /must equal the folder name/);
			assert.match(text, /MAJOR\.MINOR\.PATCH/);
			assert.match(text, /"tools"/);
			assert.match(text, /em-dash/);
			assert.match(text, /hidden files/);
			return true;
		});
	});

	test('missing item.json and SKILL.md', async () => {
		const dir = await makeSkill('empty-skill', { 'notes.md': 'x' });
		await assert.rejects(loadItem(dir), /missing item\.json[\s\S]*missing SKILL\.md/);
	});
});

describe('archives and index', () => {
	const files = new Map([
		['SKILL.md', Buffer.from(SKILL('demo'))],
		['templates/t.md', Buffer.from('template\n')],
		['scripts/run.py', Buffer.from('print(1)\n')],
	]);

	test('archive is byte-for-byte reproducible', () => {
		assert.deepEqual(buildTarGz(files), buildTarGz(new Map([...files].reverse())));
	});

	test('archive extracts with system tar', async () => {
		const out = path.join(tmp, 'extract');
		await fs.mkdir(out);
		const archive = path.join(tmp, 'demo.tar.gz');
		await fs.writeFile(archive, buildTarGz(files));
		execFileSync('tar', ['-xzf', 'demo.tar.gz', '-C', 'extract'], { cwd: tmp });
		assert.equal(await fs.readFile(path.join(out, 'templates', 't.md'), 'utf8'), 'template\n');
		assert.equal(await fs.readFile(path.join(out, 'SKILL.md'), 'utf8'), SKILL('demo'));
	});

	function indexWith(version, content) {
		const item = { id: 'demo', title: 'Demo', summary: 's', version, tools: ['claude'], hasScripts: false, contentHash: content };
		return buildIndex([item], new Map([['demo', Buffer.from('x')]]), '2026-11-12T00:00:00Z');
	}

	test('index matches the documented schema', () => {
		const idx = indexWith('1.0.0', 'h1');
		assert.equal(idx.schemaVersion, 1);
		assert.deepEqual(idx.items[0].versions['1.0.0'].archive, 'demo-1.0.0.tar.gz');
		assert.equal(idx.items[0].latest, '1.0.0');
		assert.equal(idx.items[0].type, 'skill');
	});

	test('version bump check', () => {
		assert.deepEqual(checkVersionBumps(undefined, indexWith('1.0.0', 'h1')), []);
		assert.deepEqual(checkVersionBumps(indexWith('1.0.0', 'h1'), indexWith('1.0.0', 'h1')), []);
		assert.deepEqual(checkVersionBumps(indexWith('1.0.0', 'h1'), indexWith('1.0.1', 'h2')), []);
		assert.match(checkVersionBumps(indexWith('1.0.0', 'h1'), indexWith('1.0.0', 'h2'))[0], /bump it/);
		assert.match(checkVersionBumps(indexWith('1.1.0', 'h1'), indexWith('1.0.9', 'h2'))[0], /lower than/);
	});

	test('sameContent ignores generatedAt only', () => {
		assert.ok(sameContent(indexWith('1.0.0', 'h1'), indexWith('1.0.0', 'h1')));
		assert.ok(!sameContent(indexWith('1.0.0', 'h1'), indexWith('1.0.1', 'h1')));
		assert.ok(!sameContent(undefined, indexWith('1.0.0', 'h1')));
	});
});

describe('the real library', () => {
	test('every skill in skills/ is valid', async () => {
		const root = path.resolve(import.meta.dirname, '..', 'skills');
		const items = await loadLibrary(root);
		assert.ok(items.length > 0);
	});
});
