# GitHub tutorial importer — dry-run only

Run from the **Frontend Knowledge Hub repository root** using its supported Node
version (>=22.23.4; tested on Node 24). Node runs these TypeScript files directly;
TypeScript annotations are removed at runtime. No `tsx` runner is needed.

```sh
npm ci
npm run sync-content:check
npm run sync-content:test
SANITY_PROJECT_ID=38lp1h36 SANITY_DATASET=production npm run sync-content:dry-run
```

For private GitHub repositories, set `GITHUB_TOKEN` in your shell using a token
with read-only repository contents access. For private Sanity datasets, set
`SANITY_READ_TOKEN` using a Viewer/read-only token. Do not paste secrets into
source files or command examples. These tokens are independent of each other.
The project ID and dataset name above are public configuration, not credentials.

Alternatively, put the variables in the already-ignored root `.env`, then run:

```sh
node --env-file=.env scripts/sync-content/index.ts --dry-run
```

Without GitHub access a source reports HTTP 404/403 and fails; it never substitutes
sample content. The connected GitHub app in chat does not automatically give a
local shell script its credentials.

## What it does

1. Reads `sources.json` (or `--config path`) and validates the source list.
2. Reads existing Sanity taxonomies and tasks using a **GET query only**.
3. Resolves each GitHub revision to an immutable commit, then walks the exercise
   directory recursively, including `src/components/` and assets/configuration.
4. Saves raw UTF-8 source snapshots to ignored `scripts/sync-content/.cache/`
   before transformation. Snapshots include repo, path, commit, file contents,
   and a list of excluded files. They contain no tokens or signed download URLs.
5. Runs a JavaScript, React, or Astro parser and maps the result to the existing
   `task` schema. No schema or Sanity document is modified.
6. Prints JSON containing proposed documents, per-record warnings/errors, source
   commit provenance, and a `created`, `updated`, `skipped`, `failed` summary.

**Created and updated mean “would create/update.” Nothing is written.** There is
no apply mode, mutation client, publishing command, asset upload, or workflow.
The command requires `--dry-run`; unknown flags are rejected. Any failed record
sets a nonzero exit code, but processing continues for the remaining sources.
A global configuration or Sanity-read failure returns one run-level failure.

## Mapping and editorial assumptions

| Input | Existing task field / behavior |
| --- | --- |
| Repository + exact exercise path | Stable `github-task-<SHA256 prefix>` ID; ref and file contents do not affect identity |
| Source path | Readable deterministic slug with a hash suffix |
| Explicit metadata / Markdown title | `title`; template React README is never used as an exercise title |
| Explicit description | `description`, required, at most 200 characters |
| Topic/difficulty/tag slugs | Existing published document IDs in `reference` objects; no invented taxonomy IDs |
| Instructions | Valid Portable Text `block[]` |
| Explanation README / `explanation.md` | `solutionExplanation` as Portable Text |
| Completed JavaScript and React files | `solutionCode` as a complete path-labelled Markdown text bundle |
| Astro `solution.md` | Complete solution Markdown, preserving original path headings, code fences, and CSS |
| Astro acceptance criteria and hints | `requirements` and `hints` |

The supplied metadata is an **editable editorial starting point**:

- JavaScript: its README discusses array methods, its leading script comment
  describes React favorites, but its executable code filters articles. The
  supplied title/instructions describe the implemented JavaScript filter and
  explain that discrepancy. The original files and comment remain in the bundle.
- React: README is the Vite template. The supplied instructions describe the actual
  `src/components/ArticleFavorites.jsx` example rather than importing template prose.
- Astro: instructions, explanation, and solution are separate Markdown files.
- `beginner` for JavaScript/React and `intermediate` for Astro are editorial
  assumptions, not metadata found in those repositories. Review them before any
  future write implementation. Topic/tag/difficulty slugs were checked against
  the existing dataset, but their IDs are always resolved dynamically.
- No starter files are labelled or supplied by these exercises. Completed code
  goes in `solutionCode`; `starterCode` and `publishedAt` are left unset.
- One proposed task is generated per configured directory. This first version
  does not split several exercises from one file or execute any downloaded code.

Missing title, description, instructions, topic, or difficulty fails the record.
Unresolved or ambiguous taxonomy slugs fail rather than guessing. Optional tags
may be omitted with a warning. An optional `estimatedMinutes` must be an integer
>=1. Reference arrays receive deterministic `_key` values.

### Multi-file examples and rich text

`solutionCode` is currently a **text field**, not a files array. JavaScript/React
examples therefore use a documented text bundle containing each original path
and complete UTF-8 file content, including nested components, styles, SVGs,
package/configuration files and README. It is an archive for review, not a
single executable file. A future UI can parse/render that bundle, or a future
schema change can introduce structured code files after review.

Lockfiles, `.gitignore`, generated/dependency directories, and binary assets are
not embedded. Their paths appear in warnings and raw snapshots. In particular,
the current React source includes `src/assets/hero.png`: it is reported, not
uploaded, so this dry-run does **not** produce a standalone runnable React app.
All fetched source text is preserved; unsupported symlinks/submodules and size
limits fail instead of producing incomplete task documents. Limits are 500
entries, 1 MB/file and 5 MB/exercise, with a 30-second timeout per GET request.

Markdown uses `@portabletext/markdown`. The existing schema allows only regular
text blocks, so fenced code becomes code-marked text blocks. Unsupported tables,
images and HTML objects become visible JSON text with a warning, preserving
content without emitting unsupported schema types. This is a formatting compromise
for v1, not a schema migration. Generated keys are stable across reruns, including
link annotation references. Both rich-text fields are validated before reporting.

### Existing documents and reruns

- Same deterministic ID and identical importer-owned fields: `skipped`.
- Same deterministic ID and changed importer-owned fields: `updated` proposal.
- No matching ID: `created` proposal.
- Draft/release versions or a matching slug on another task ID: fail for manual review.

Sanity timestamps/revisions and unrelated fields do not cause false updates.
Draft/release collision detection depends on API visibility: a public query
cannot inspect private drafts or release versions. Use a read token with the
required visibility when reviewing an eventual update plan.
Existing hand-authored tasks with unrelated IDs **and different slugs** cannot
be identified as the same exercise automatically; reconcile them manually before
any future publishing. This importer does not implement writes or deletions.

## Offline and reproducible checks

`tests/fixtures/` contains real GitHub text snapshots pinned to these commits:

- `rmznvn/js-tutor`: `6e5162ceb24ff8c61371083ff45addbad6792924`
- `rmznvn/astor-tutor`: `75cf663d317e9a9a2336305e81eab2f2b939f242`

Tests use fictional taxonomy IDs, not credentials or production document IDs.
They test all three formats, nested source retention, repeatability, missing and
ambiguous references, required fields, drafts/collisions and all summary states.

For a fully network-free demonstration using the real source fixtures and
**fictional** reference IDs:

```sh
node scripts/sync-content/tests/prepare-offline.ts
npm run sync-content:dry-run -- --state scripts/sync-content/.cache/offline/state.json --snapshots scripts/sync-content/.cache/offline
```

For a network-free CLI rehearsal with your own read-only Sanity export:

```sh
npm run sync-content:dry-run -- --state /absolute/path/state.json --snapshots /absolute/path/snapshots
```

State JSON must contain `{ "references": [...], "tasks": [...] }`; references need
`_id`, `_type` and `slug.current`, and tasks should be complete documents for accurate
comparison. Snapshot files use the first 24 SHA256 hex characters of
`owner/repository/exercise/path`, followed by `.json`. Their shape is
`{ repository, path, commit, files: { "relative/path": "contents" }, excluded: [] }`.
Use files from a previous `.cache/` extraction or the fixture preparation command
in `tests/prepare-offline.ts`. `--cache directory` selects another output folder.
Do not commit private exports or caches. Offline reports explicitly say they were
not verified against the current dataset.

There is no cutover or redirect step in this version because it never publishes
content or changes frontend routes.
