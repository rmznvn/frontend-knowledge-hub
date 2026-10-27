import { isDeepStrictEqual } from 'node:util';
import { parseAstro, parseJavaScript, parseReact } from './parsers.ts';
import { hash, portableText, validatePortableText } from './portable-text.ts';
import type { Reference, Snapshot, Source, State, Task, Taxonomy } from './types.ts';

export const sourceKey = (source: Pick<Source, 'repository' | 'path'>): string => `${source.repository}/${source.path}`;
export const taskId = (source: Pick<Source, 'repository' | 'path'>): string => `github-task-${hash(sourceKey(source)).slice(0, 40)}`;

export function resolveReference(state: State, type: Taxonomy['_type'], slug: string): Reference {
  const matches = state.references.filter(doc => doc._type === type && doc.slug?.current === slug);
  if (matches.length !== 1) throw new Error(`${type} slug "${slug}" resolved to ${matches.length} documents; expected exactly one published document`);
  const id = matches[0]!._id;
  if (!id || id.startsWith('drafts.') || id.startsWith('versions.')) throw new Error(`${type} "${slug}" has no published ID`);
  return { _type: 'reference', _ref: id };
}

export function bundleFiles(snapshot: Snapshot): string {
  return Object.entries(snapshot.files).sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => {
    const runs = content.match(/`+/g) ?? [];
    const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
    return `## File: ${path}\n\n${fence}\n${content}\n${fence}`;
  }).join('\n\n');
}

export function buildTask(source: Source, snapshot: Snapshot, state: State): { document: Task; warnings: string[] } {
  if (snapshot.repository !== source.repository || snapshot.path !== source.path) throw new Error('Snapshot belongs to another exercise');
  const parsed = { javascript: parseJavaScript, react: parseReact, astro: parseAstro }[source.format](snapshot);
  const metadata = source.metadata;
  const title = metadata.title ?? parsed.title;
  const instructions = metadata.instructions ?? parsed.instructions;
  const errors: string[] = [];
  for (const [field, value] of Object.entries({ title, instructions, description: metadata.description, topic: metadata.topic, difficulty: metadata.difficulty })) {
    if (typeof value !== 'string' || !value.trim()) errors.push(`Missing metadata: ${field}`);
  }
  if (metadata.description && metadata.description.length > 200) errors.push('description exceeds schema maximum of 200 characters');
  if (metadata.estimatedMinutes !== undefined && (!Number.isInteger(metadata.estimatedMinutes) || metadata.estimatedMinutes < 1)) errors.push('estimatedMinutes must be an integer >= 1');
  if (metadata.tags && (!Array.isArray(metadata.tags) || metadata.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) errors.push('tags must contain non-empty slugs');
  const references: Record<string, Reference> = {};
  for (const [type, slug] of [['topic', metadata.topic], ['difficulty', metadata.difficulty]] as const) {
    if (slug) { try { references[type] = resolveReference(state, type, slug); } catch (error) { errors.push((error as Error).message); } }
  }
  const tags: Reference[] = [];
  if (Array.isArray(metadata.tags)) for (const slug of new Set(metadata.tags)) {
    try { tags.push({ ...resolveReference(state, 'tag', slug), _key: `tag-${hash(slug).slice(0, 12)}` }); }
    catch (error) { errors.push((error as Error).message); }
  }
  if (errors.length) throw new Error(errors.join('; '));
  const warnings = [...parsed.warnings];
  if (!metadata.tags?.length) warnings.push('No tag metadata supplied; tags is optional in the current schema.');
  if (snapshot.excluded.length) warnings.push(`Files not embedded (assets/lockfiles/ignored paths): ${snapshot.excluded.join(', ')}`);
  const id = taskId(source);
  const slug = sourceKey(source).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) + '-' + hash(sourceKey(source)).slice(0, 12);
  const document: Task = {
    _id: id, _type: 'task', title, slug: { _type: 'slug', current: slug },
    description: metadata.description!, topic: references.topic!, difficulty: references.difficulty!,
    instructions: portableText(instructions, warnings), language: parsed.language,
    solutionCode: parsed.solutionCode ?? bundleFiles(snapshot),
    ...(tags.length ? { tags } : {}),
    ...(metadata.estimatedMinutes !== undefined ? { estimatedMinutes: metadata.estimatedMinutes } : {}),
    ...(parsed.hints?.length ? { hints: parsed.hints } : {}),
    ...(parsed.requirements?.length ? { requirements: parsed.requirements } : {}),
    ...(parsed.explanation ? { solutionExplanation: portableText(parsed.explanation, warnings) } : {}),
  };
  validatePortableText(document.instructions, 'instructions');
  if (document.solutionExplanation) validatePortableText(document.solutionExplanation, 'solutionExplanation');
  return { document, warnings: [...new Set(warnings)] };
}

export type Status = 'created' | 'updated' | 'skipped' | 'failed';
export interface RecordResult {
  source: string;
  commit?: string;
  status: Status;
  document?: Task;
  warnings?: string[];
  error?: string;
}

const ownedFields: (keyof Task)[] = ['_id', '_type', 'title', 'slug', 'description', 'topic', 'tags', 'difficulty', 'estimatedMinutes', 'instructions', 'requirements', 'solutionCode', 'solutionExplanation', 'language', 'hints'];
export function classify(document: Task, state: State): Status {
  if (state.tasks.some(task => task._id === `drafts.${document._id}` || (typeof task._id === 'string' && task._id.startsWith('versions.') && task._id.endsWith(`.${document._id}`)))) {
    throw new Error('An existing draft or release version requires manual review');
  }
  if (state.tasks.some(task => (task.slug as { current?: string } | undefined)?.current === document.slug.current && task._id !== document._id)) throw new Error('Slug collision with another task ID; manual reconciliation required');
  const current = state.tasks.filter(task => task._id === document._id);
  if (current.length > 1) throw new Error('Duplicate existing task IDs in state');
  if (!current.length) return 'created';
  return ownedFields.every(field => isDeepStrictEqual(current[0]![field], document[field])) ? 'skipped' : 'updated';
}

export function planRecord(source: Source, snapshot: Snapshot, state: State): RecordResult {
  try {
    const { document, warnings } = buildTask(source, snapshot, state);
    return { source: sourceKey(source), commit: snapshot.commit, status: classify(document, state), document, warnings };
  } catch (error) {
    return { source: sourceKey(source), commit: snapshot.commit, status: 'failed', error: (error as Error).message };
  }
}

export function summarize(records: RecordResult[]): Record<Status, number> {
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const record of records) summary[record.status]++;
  return summary;
}
