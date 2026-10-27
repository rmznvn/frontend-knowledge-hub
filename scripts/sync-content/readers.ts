import { TextDecoder } from 'node:util';
import type { Snapshot, Source, State } from './types.ts';

type Entry = { type: string; path: string; sha: string; size: number };
const segmentPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');
const ignored = /(^|\/)(node_modules|dist|\.git|\.astro)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.gitignore)$/;

async function getJson(url: string, token?: string): Promise<unknown> {
  // This module intentionally exposes only GET, never a Sanity mutation client.
  const response = await fetch(url, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json', 'User-Agent': 'frontend-knowledge-hub-importer', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`Read request failed: HTTP ${response.status} (${new URL(url).hostname}); check access, rate limits and configuration`);
  return response.json();
}

export async function readGitHub(source: Source): Promise<Snapshot> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(source.repository) || source.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid GitHub repository or path');
  const token = process.env.GITHUB_TOKEN;
  const base = `https://api.github.com/repos/${source.repository}`;
  // Resolve one immutable revision before traversing, so all files form one snapshot.
  const revision = await getJson(`${base}/commits/${encodeURIComponent(source.ref ?? 'HEAD')}`, token) as { sha: string };
  if (!/^[a-f0-9]{40}$/.test(revision.sha)) throw new Error('GitHub did not return a commit SHA');
  const snapshot: Snapshot = { repository: source.repository, path: source.path, commit: revision.sha, files: {}, excluded: [] };
  let count = 0;
  let bytes = 0;
  async function walk(path: string): Promise<void> {
    const entries = await getJson(`${base}/contents/${segmentPath(path)}?ref=${revision.sha}`, token) as Entry[];
    if (!Array.isArray(entries)) throw new Error(`Expected directory at ${path}`);
    for (const entry of entries.sort((a, b) => a.path.localeCompare(b.path))) {
      if (++count > 500) throw new Error('Exercise exceeds 500 entries; narrow the source path');
      const relative = entry.path.slice(source.path.length + 1);
      if (!entry.path.startsWith(source.path + '/') || relative.split('/').includes('..')) throw new Error('Unexpected GitHub entry path');
      if (ignored.test(relative)) { snapshot.excluded.push(relative); continue; }
      if (entry.type === 'dir') { await walk(entry.path); continue; }
      if (entry.type !== 'file') throw new Error(`Unsupported symlink or submodule: ${relative}`);
      if (entry.size > 1_000_000 || (bytes += entry.size) > 5_000_000) throw new Error(`Source size limit exceeded at ${relative}; no partial document produced`);
      const blob = await getJson(`${base}/git/blobs/${entry.sha}`, token) as { encoding: string; content: string };
      if (blob.encoding !== 'base64') throw new Error(`Unsupported blob encoding for ${relative}`);
      const buffer = Buffer.from(blob.content, 'base64');
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        if (text.includes('\0')) throw new Error('Binary content');
        snapshot.files[relative] = text;
      } catch { snapshot.excluded.push(relative); }
    }
  }
  await walk(source.path);
  return snapshot;
}

export async function readSanity(): Promise<State> {
  const project = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  if (!project || !/^[a-z0-9]+$/.test(project) || !dataset || !/^[a-zA-Z0-9_-]+$/.test(dataset)) throw new Error('Set valid SANITY_PROJECT_ID and SANITY_DATASET; no credentials are hardcoded');
  // raw perspective includes drafts for collision detection. Taxonomy references
  // themselves are restricted to published documents with real existing IDs.
  const query = `{
    "references": *[_type in ["topic", "tag", "difficulty"] && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]{_id, _type, slug},
    "tasks": *[_type == "task"]
  }`;
  const url = new URL(`https://${project}.api.sanity.io/v2026-03-01/data/query/${dataset}`);
  url.searchParams.set('query', query);
  url.searchParams.set('perspective', 'raw');
  const payload = await getJson(url.toString(), process.env.SANITY_READ_TOKEN) as { result: State };
  if (!Array.isArray(payload.result?.references) || !Array.isArray(payload.result?.tasks)) throw new Error('Sanity returned an unexpected state shape');
  return payload.result;
}
