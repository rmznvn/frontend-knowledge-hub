import type { Parsed, Snapshot } from './types.ts';

function required(files: Snapshot['files'], name: string): string {
  const text = files[name];
  if (!text?.trim()) throw new Error(`Missing or empty source file: ${name}`);
  return text;
}

function title(text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? '';
}

function section(text: string, name: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim().toLowerCase() === `## ${name}`.toLowerCase());
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => /^##\s/.test(line));
  return rest.slice(0, end < 0 ? undefined : end).join('\n').trim() || undefined;
}

export function parseJavaScript(snapshot: Snapshot): Parsed {
  const script = required(snapshot.files, 'script.js');
  const readme = required(snapshot.files, 'README.md');
  const leadingComment = /^\s*\/\*([\s\S]*?)\*\//.exec(script)?.[1]?.trim();
  return {
    title: title(readme),
    instructions: leadingComment ?? readme,
    explanation: readme,
    language: 'javascript',
    warnings: [
      'JavaScript README and script task comment describe different exercises; review title and instructions overrides.',
      'Completed source is retained as reference solution; no starter code is invented.',
    ],
  };
}

export function parseReact(snapshot: Snapshot): Parsed {
  required(snapshot.files, 'src/App.jsx');
  required(snapshot.files, 'src/main.jsx');
  if (!Object.keys(snapshot.files).some(path => /^src\/components\/.+\.[jt]sx?$/.test(path))) {
    throw new Error('React exercise has no nested src/components source files');
  }
  const task = snapshot.files['task.md'];
  return {
    title: task ? title(task) : '',
    instructions: task ?? '',
    language: 'jsx',
    warnings: [
      ...(!task ? ['React README is a Vite template: supply an exercise title and instructions in metadata.'] : []),
      'All text files, including nested components, styles and configuration, are retained as reference solution.',
      'Completed source is not automatically treated as starter code.',
    ],
  };
}

export function parseAstro(snapshot: Snapshot): Parsed {
  const task = required(snapshot.files, 'task.md');
  const solution = required(snapshot.files, 'solution.md');
  const explanation = required(snapshot.files, 'explanation.md');
  // Keep the complete Markdown solution: its headings identify paths, and its
  // fenced examples include Astro, TypeScript, Markdown content files and CSS.
  return {
    title: title(task), instructions: task, explanation,
    solutionCode: solution, language: 'astro',
    hints: section(task, 'Hints')?.split('\n').filter(line => /^\d+\.\s/.test(line)).map(line => line.replace(/^\d+\.\s*/, '')),
    requirements: section(task, 'Acceptance criteria')?.split('\n').filter(line => /^-\s/.test(line)).map(line => line.replace(/^-\s*/, '')),
    warnings: ['Astro solutionCode is a Markdown file bundle with original path headings and code fences; it is not a single executable Astro file.'],
  };
}
