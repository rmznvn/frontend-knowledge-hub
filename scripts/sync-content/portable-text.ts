import { markdownToPortableText } from '@portabletext/markdown';
import { createHash } from 'node:crypto';
import type { Block } from './types.ts';

export const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

function textBlock(text: string, code = false): Block {
  return {
    _type: 'block', _key: '', style: 'normal', markDefs: [],
    children: [{ _type: 'span', _key: '', text, marks: code ? ['code'] : [] }],
  };
}

export function portableText(markdown: string, warnings: string[]): Block[] {
  const blocks = markdownToPortableText(markdown);
  const result: Block[] = [];
  for (const raw of blocks) {
    const value = raw as unknown as Record<string, unknown>;
    if (value._type === 'block') {
      const block = value as unknown as Block;
      if (block.listItem === 'task') {
        block.listItem = 'bullet';
        warnings.push('Task checklist converted to a bullet list because the schema has no task list style.');
      }
      // The current schema permits only spans inside text blocks.
      if (!block.children.every(child => child._type === 'span')) {
        throw new Error('Unsupported inline object in Portable Text; manual conversion required');
      }
      result.push(block);
    } else if (value._type === 'code') {
      result.push(textBlock(String(value.code ?? ''), true));
      warnings.push('Code fence rendered as a code-marked text block; task schema has no custom code block.');
    } else {
      // Preserve otherwise unsupported tables/images/HTML as visible JSON text.
      // No custom _type is emitted and no content is silently thrown away.
      const { _key: ignored, ...content } = value;
      void ignored;
      result.push(textBlock(JSON.stringify(content, (key, item: unknown) => key === '_key' ? undefined : item)));
      warnings.push(`Portable Text ${String(value._type)} preserved as plain JSON text; review presentation.`);
    }
  }
  // Replace library-generated random keys, including annotation references, so
  // the same input compares equal on every dry run.
  result.forEach((block, index) => {
    block._key = `b${index}-${hash(markdown).slice(0, 8)}`;
    const marks = new Map(block.markDefs.map((mark, i) => [mark._key, `m${index}-${i}`]));
    block.markDefs.forEach(mark => { mark._key = marks.get(mark._key)!; });
    block.children.forEach((span, i) => {
      span._key = `s${index}-${i}`;
      span.marks = span.marks.map(mark => marks.get(mark) ?? mark);
    });
  });
  return result;
}

export function validatePortableText(blocks: Block[], field: string): void {
  if (!blocks.length || !blocks.some(block => block.children.some(span => span.text.trim()))) {
    throw new Error(`${field} must contain non-empty Portable Text`);
  }
  const styles = new Set(['normal', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);
  const decorators = new Set(['strong', 'em', 'code', 'underline', 'strike-through']);
  const keys = new Set<string>();
  for (const block of blocks) {
    if (block._type !== 'block' || !block._key || keys.has(block._key) || !styles.has(block.style)) {
      throw new Error(`Invalid ${field} block type, key or style`);
    }
    keys.add(block._key);
    if (block.listItem && (!['bullet', 'number'].includes(block.listItem) || !Number.isInteger(block.level) || block.level! < 1)) {
      throw new Error(`Invalid ${field} list`);
    }
    for (const mark of block.markDefs) {
      if (mark._type !== 'link' || !mark._key || typeof mark.href !== 'string') throw new Error(`Invalid ${field} annotation`);
    }
    const childKeys = new Set<string>();
    for (const span of block.children) {
      if (span._type !== 'span' || typeof span.text !== 'string' || !span._key || childKeys.has(span._key)) throw new Error(`Invalid ${field} span`);
      childKeys.add(span._key);
      if (!span.marks.every(mark => decorators.has(mark) || block.markDefs.some(def => def._key === mark))) throw new Error(`Unresolved ${field} mark`);
    }
  }
}
