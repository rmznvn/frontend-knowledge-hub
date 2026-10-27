import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildTask, classify, planRecord, resolveReference, summarize, taskId } from '../planner.ts';
import { parseJavaScript, parseReact, parseAstro } from '../parsers.ts';
import { hash, portableText, validatePortableText } from '../portable-text.ts';
import { readGitHub } from '../readers.ts';
import type { Snapshot, Source, State } from '../types.ts';

const sources = JSON.parse(await readFile(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
const snapshots = await Promise.all(['javascript', 'react', 'astro'].map(async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Snapshot));
// Deliberately fictional IDs: tests prove slug lookup, never encode production IDs.
const state: State = {
  references: [
    ...['javascript', 'react', 'astro'].map(slug => ({ _id: `test-topic-${slug}`, _type: 'topic' as const, slug: { current: slug } })),
    ...['arrays', 'string', 'ui-components', 'accessibility', 'css'].map(slug => ({ _id: `test-tag-${slug}`, _type: 'tag' as const, slug: { current: slug } })),
    ...['beginner', 'intermediate'].map(slug => ({ _id: `test-difficulty-${slug}`, _type: 'difficulty' as const, slug: { current: slug } })),
  ], tasks: [],
};

for (let i = 0; i < sources.length; i++) {
  const source = sources[i]!, snapshot = snapshots[i]!;
  test(`${source.format}: real source transforms to stable, schema-compatible task`, () => {
    const first = buildTask(source, snapshot, state);
    const second = buildTask(source, snapshot, state);
    assert.deepEqual(first, second);
    assert.equal(first.document._id, taskId(source));
    assert.equal(first.document.topic._ref, `test-topic-${source.metadata.topic}`);
    assert.equal(first.document.difficulty._ref, `test-difficulty-${source.metadata.difficulty}`);
    validatePortableText(first.document.instructions, 'instructions');
    if (first.document.solutionExplanation) validatePortableText(first.document.solutionExplanation, 'explanation');
    assert.equal(classify(first.document, state), 'created');
    const saved = { ...first.document, _rev: 'revision', _updatedAt: 'timestamp' };
    assert.equal(classify(first.document, { ...state, tasks: [saved] }), 'skipped');
    assert.equal(classify(first.document, { ...state, tasks: [{ ...saved, title: 'Changed by editor' }] }), 'updated');
    assert.equal(planRecord(source, snapshot, { ...state, references: [] }).status, 'failed');
  });
}

test('React preserves every fetched text file, including nested components and SVGs', () => {
  const snapshot = snapshots[1]!;
  const { document, warnings } = buildTask(sources[1]!, snapshot, state);
  assert.ok(document.solutionCode?.includes('src/components/ArticleFavorites.jsx'));
  assert.ok(document.solutionCode?.includes('useState'));
  for (const [path, content] of Object.entries(snapshot.files)) {
    assert.ok(document.solutionCode?.includes(`## File: ${path}`), path);
    assert.ok(document.solutionCode?.includes(content), path);
  }
  assert.ok(warnings.some(warning => warning.includes('hero.png')));
});

test('Parsers reflect all three actual source layouts and report ambiguous metadata', () => {
  assert.match(parseJavaScript(snapshots[0]!).instructions, /Задача 2/);
  assert.equal(parseReact(snapshots[1]!).instructions, '');
  const astro = parseAstro(snapshots[2]!);
  assert.equal(astro.hints?.length, 5);
  assert.equal(astro.requirements?.length, 8);
  assert.ok(astro.solutionCode?.includes('src/components/ResourceCard.astro'));
  assert.ok(astro.solutionCode?.includes('@container'));
  assert.throws(() => parseReact({ ...snapshots[1]!, files: { 'src/App.jsx': 'app', 'src/main.jsx': 'main' } }), /nested/);
  assert.throws(() => parseAstro({ ...snapshots[2]!, files: {} }), /task.md/);
});

test('Missing, ambiguous, and draft-only references fail without fabricated IDs', () => {
  assert.throws(() => resolveReference(state, 'topic', 'missing'), /0 documents/);
  const topic = state.references[0]!;
  assert.throws(() => resolveReference({ ...state, references: [topic, { ...topic, _id: 'other' }] }, 'topic', 'javascript'), /2 documents/);
  assert.throws(() => resolveReference({ ...state, references: [{ ...topic, _id: 'drafts.topic' }] }, 'topic', 'javascript'), /published ID/);
});

test('Required metadata and schema number/length constraints are checked', () => {
  const source = sources[1]!, snapshot = snapshots[1]!;
  const missing = planRecord({ ...source, metadata: {} }, snapshot, state);
  assert.equal(missing.status, 'failed');
  for (const field of ['title', 'instructions', 'description', 'topic', 'difficulty']) assert.ok(missing.error?.includes(field));
  assert.throws(() => buildTask({ ...source, metadata: { ...source.metadata, description: 'x'.repeat(201), estimatedMinutes: 1.2 } }, snapshot, state), /200 characters.*integer/);
});

test('ID uses repository and path, not mutable title, ref or current code', () => {
  assert.equal(taskId(sources[0]!), taskId({ ...sources[0]! }));
  assert.notEqual(taskId(sources[0]!), taskId(sources[1]!));
  assert.notEqual(taskId(sources[0]!), taskId({ ...sources[0]!, repository: 'another/repo' }));
});

test('Existing draft/release and slug collisions require manual review', () => {
  const { document } = buildTask(sources[0]!, snapshots[0]!, state);
  for (const id of [`drafts.${document._id}`, `versions.release.${document._id}`]) assert.throws(() => classify(document, { ...state, tasks: [{ _id: id }] }), /manual review/);
  assert.throws(() => classify(document, { ...state, tasks: [{ _id: 'legacy', slug: document.slug }] }), /Slug collision/);
});

test('Markdown conversion supports headings, lists, marks, fences, tables and deterministic keys', () => {
  const markdown = '# Heading\n\n**bold** and [a link](https://example.com)\n\n- item\n\n~~~js\nconst answer = 42;\n~~~\n\n| A | B |\n|---|---|\n| 1 | 2 |';
  const warnings: string[] = [];
  const blocks = portableText(markdown, warnings);
  validatePortableText(blocks, 'test');
  assert.deepEqual(blocks, portableText(markdown, []));
  assert.ok(blocks.every(block => block._type === 'block'));
  assert.ok(blocks.some(block => block.style === 'h1'));
  assert.ok(warnings.some(warning => warning.includes('Code fence')));
  assert.ok(warnings.some(warning => warning.includes('table')));
  assert.throws(() => validatePortableText([], 'instructions'), /non-empty/);
});

test('Summary counts proposed actions and failures independently', () => {
  const record = { source: 'example' };
  assert.deepEqual(summarize([
    { ...record, status: 'created' }, { ...record, status: 'updated' },
    { ...record, status: 'skipped' }, { ...record, status: 'failed' },
  ]), { created: 1, updated: 1, skipped: 1, failed: 1 });
});

test('GitHub reader pins revision, recurses into components, reports assets, and uses GET only', async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  const commit = 'a'.repeat(40);
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, 'GET');
    const url = String(input); requests.push(url);
    let response: unknown;
    if (url.includes('/commits/')) response = { sha: commit };
    else if (url.includes('/git/blobs/asset')) response = { encoding: 'base64', content: Buffer.from([0x89, 0x50, 0x00]).toString('base64') };
    else if (url.includes('/git/blobs/')) response = { encoding: 'base64', content: Buffer.from('export default function Example() {}').toString('base64') };
    else if (url.includes('/contents/react/task-1/src/components?')) response = [{ type: 'file', path: 'react/task-1/src/components/Example.jsx', sha: 'code', size: 36 }];
    else response = [
      { type: 'dir', path: 'react/task-1/src/components', sha: 'folder', size: 0 },
      { type: 'file', path: 'react/task-1/hero.png', sha: 'asset', size: 3 },
    ];
    return new Response(JSON.stringify(response), { status: 200 });
  };
  try {
    const snapshot = await readGitHub(sources[1]!);
    assert.ok(snapshot.files['src/components/Example.jsx']);
    assert.deepEqual(snapshot.excluded, ['hero.png']);
    assert.ok(requests.filter(url => url.includes('/contents/')).every(url => url.includes(commit)));
  } finally { globalThis.fetch = original; }
});

test('CLI refuses write flags and missing --dry-run without attempting reads', () => {
  const cli = fileURLToPath(new URL('../index.ts', import.meta.url));
  for (const args of [[], ['--dry-run', '--apply']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stderr) as { summary: { failed: number } };
    assert.equal(report.summary.failed, 1);
  }
});

test('CLI prints proposed documents and accurate created/updated/skipped and failed summaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fkh-cli-test-'));
  const cli = fileURLToPath(new URL('../index.ts', import.meta.url));
  try {
    for (const snapshot of snapshots) {
      await writeFile(join(directory, `${hash(`${snapshot.repository}/${snapshot.path}`).slice(0, 24)}.json`), JSON.stringify(snapshot));
    }
    const first = buildTask(sources[0]!, snapshots[0]!, state).document;
    const second = buildTask(sources[1]!, snapshots[1]!, state).document;
    await writeFile(join(directory, 'state.json'), JSON.stringify({ ...state, tasks: [first, { ...second, title: 'Outdated' }] }));
    const args = [cli, '--dry-run', '--state', join(directory, 'state.json'), '--snapshots', directory, '--cache', directory];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as { dryRun: boolean; records: unknown[]; summary: Record<string, number> };
    assert.equal(report.dryRun, true);
    assert.equal(report.records.length, 3);
    assert.deepEqual(report.summary, { created: 1, updated: 1, skipped: 1, failed: 0 });
    await writeFile(join(directory, 'state.json'), JSON.stringify({ ...state, references: [] }));
    const failed = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.deepEqual(JSON.parse(failed.stdout).summary, { created: 0, updated: 0, skipped: 0, failed: 3 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
