// Prepare the real source fixtures plus fictional reference IDs for a fully
// offline CLI demonstration. Never substitute this state for a live dataset.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hash } from '../portable-text.ts';
import { sourceKey } from '../planner.ts';
import type { Snapshot, Source, State } from '../types.ts';

const output = resolve(process.argv[2] ?? 'scripts/sync-content/.cache/offline');
await mkdir(output, { recursive: true });
const sources = JSON.parse(await readFile(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
const state: State = { references: [], tasks: [] };
for (const format of ['javascript', 'react', 'astro']) {
  const snapshot = JSON.parse(await readFile(new URL(`./fixtures/${format}.json`, import.meta.url), 'utf8')) as Snapshot;
  await writeFile(join(output, `${hash(sourceKey(snapshot)).slice(0, 24)}.json`), JSON.stringify(snapshot, null, 2));
}
for (const source of sources) {
  for (const [type, slugs] of [['topic', [source.metadata.topic!]], ['difficulty', [source.metadata.difficulty!]], ['tag', source.metadata.tags ?? []]] as const) {
    for (const slug of slugs) if (!state.references.some(doc => doc._type === type && doc.slug.current === slug)) {
      state.references.push({ _id: `offline-${type}-${slug}`, _type: type, slug: { current: slug } });
    }
  }
}
await writeFile(join(output, 'state.json'), JSON.stringify(state, null, 2));
console.log(`Offline fixtures and fictional state saved to ${output}`);
