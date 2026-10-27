export type Format = 'javascript' | 'react' | 'astro';
export interface Source {
  repository: string;
  path: string;
  format: Format;
  ref?: string;
  metadata: {
    title?: string;
    description?: string;
    topic?: string;
    tags?: string[];
    difficulty?: string;
    instructions?: string;
    estimatedMinutes?: number;
  };
}
export interface Snapshot {
  repository: string;
  path: string;
  commit: string;
  files: Record<string, string>;
  excluded: string[];
}
export interface Parsed {
  title: string;
  instructions: string;
  explanation?: string;
  solutionCode?: string;
  language: string;
  hints?: string[];
  requirements?: string[];
  warnings: string[];
}
export interface Block {
  _type: 'block';
  _key: string;
  style: string;
  children: { _type: 'span'; _key: string; text: string; marks: string[] }[];
  markDefs: { _key: string; _type: string; href?: string; title?: string }[];
  listItem?: string;
  level?: number;
}
export interface Reference { _type: 'reference'; _ref: string; _key?: string }
export interface Task {
  _id: string;
  _type: 'task';
  title: string;
  slug: { _type: 'slug'; current: string };
  description: string;
  topic: Reference;
  tags?: Reference[];
  difficulty: Reference;
  estimatedMinutes?: number;
  instructions: Block[];
  requirements?: string[];
  solutionCode?: string;
  solutionExplanation?: Block[];
  language: string;
  hints?: string[];
}
export interface Taxonomy {
  _id: string;
  _type: 'topic' | 'tag' | 'difficulty';
  slug: { current: string };
}
export interface State {
  references: Taxonomy[];
  // Full task documents are needed to distinguish an update from a no-op.
  tasks: Record<string, unknown>[];
}
