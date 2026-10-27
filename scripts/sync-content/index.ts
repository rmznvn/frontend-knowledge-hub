import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './portable-text.ts';
import { planRecord, sourceKey, summarize } from './planner.ts';
import { readGitHub, readSanity } from './readers.ts';
import type { RecordResult } from './planner.ts';
import type { Snapshot, Source, State } from './types.ts';

const usage = 'node scripts/sync-content/index.ts --dry-run [--config path] [--state path] [--snapshots directory] [--cache directory]';
function parseOptions(): Record<string, string> {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (flag === '--help') { console.log(usage); process.exit(0); }
    if (flag === '--dry-run') { dryRun = true; continue; }
    if (!['--config', '--state', '--snapshots', '--cache'].includes(flag) || !args[i + 1] || args[i + 1]!.startsWith('--')) {
      throw new Error(`Unknown or incomplete option: ${flag}\n${usage}`);
    }
    options[flag.slice(2)] = args[++i]!;
  }
  if (!dryRun) throw new Error(`Only --dry-run is supported. No Sanity write operation exists.\n${usage}`);
  return options;
}

try {
  const options = parseOptions();
  const configFile = options.config ?? fileURLToPath(new URL('./sources.json', import.meta.url));
  const value: unknown = JSON.parse(await readFile(configFile, 'utf8'));
  if (!Array.isArray(value) || !value.length) throw new Error('Config must be a non-empty source array');
  const sources = value as Source[];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source || typeof source.repository !== 'string' || typeof source.path !== 'string' || !['javascript', 'react', 'astro'].includes(source.format) || !source.metadata || typeof source.metadata !== 'object') throw new Error('Invalid source configuration');
    if (seen.has(sourceKey(source))) throw new Error(`Duplicate source configuration: ${sourceKey(source)}`);
    seen.add(sourceKey(source));
  }
  const state: State = options.state ? JSON.parse(await readFile(options.state, 'utf8')) as State : await readSanity();
  if (!Array.isArray(state.references) || !Array.isArray(state.tasks)) throw new Error('State must contain references and tasks arrays');
  const cache = resolve(options.cache ?? fileURLToPath(new URL('./.cache', import.meta.url)));
  await mkdir(cache, { recursive: true });
  const records: RecordResult[] = [];
  for (const source of sources) {
    try {
      const filename = `${hash(sourceKey(source)).slice(0, 24)}.json`;
      const snapshot: Snapshot = options.snapshots
        ? JSON.parse(await readFile(join(options.snapshots, filename), 'utf8')) as Snapshot
        : await readGitHub(source);
      if (!snapshot.commit || !snapshot.files || !Array.isArray(snapshot.excluded)) throw new Error('Invalid snapshot');
      // Raw extraction is saved before transformation; it contains no tokens or signed URLs.
      await writeFile(join(cache, filename), JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 });
      records.push(planRecord(source, snapshot, state));
    } catch (error) {
      records.push({ source: sourceKey(source), status: 'failed', error: (error as Error).message });
    }
  }
  const report = { dryRun: true, state: options.state ? 'offline snapshot (not verified against live Sanity)' : 'live read-only Sanity query', note: 'created/updated are proposed actions only; no documents were written', records, summary: summarize(records) };
  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ dryRun: true, error: (error as Error).message, summary: { created: 0, updated: 0, skipped: 0, failed: 1 } }, null, 2));
  process.exitCode = 1;
}
