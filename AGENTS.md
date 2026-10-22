## Project and architecture

Frontend Knowledge Hub is an interactive frontend learning platform built with
Astro 7, React, TypeScript, and Tailwind CSS 4. shadcn/ui and Sanity are planned;
do not install or scaffold them until the user requests that work.

- Work in this existing repository. Do not create another project or nested app.
- `src/pages/` contains Astro file-based routes. Keep pages focused on composing content.
- `src/layouts/BaseLayout.astro` owns the HTML document, shared metadata, and global
  stylesheet import. Use its slot for page content and its typed props for page metadata.
- `src/styles/global.css` is the shared CSS entry point and imports Tailwind.
  Tailwind 4 runs through `@tailwindcss/vite` in `astro.config.mjs`.
- Prefer Astro components for static content. Put future reusable components in
  `src/components/`; use React `.tsx` components for stateful interactive features.
- React is registered through `@astrojs/react`. Add an appropriate `client:*`
  directive when a React component needs browser interactivity, such as
  `client:load` for an immediately interactive control or `client:visible` for
  an exercise farther down the page.
- Keep TypeScript strict. Type component props and shared data; avoid `any`.
  The `@/*` alias maps to `src/*`, for example `@/layouts/BaseLayout.astro`.
- When requested later, place shadcn/ui primitives in `src/components/ui/` and
  keep Sanity content access separate from UI components. Never expose private
  Sanity credentials in client code.
- Use semantic HTML, accessible labels, keyboard-friendly controls, and Tailwind
  utilities. Keep shared CSS intentional and avoid unnecessary dependencies.

## Learning and collaboration rules

- Explain important changes in plain language: what changed, why it helps, and
  how the relevant Astro, React, or TypeScript feature works.
- Make small, focused changes. Do not build ahead into a full UI or add unrequested tools.
- Preserve existing user edits and follow established project conventions.
- Explain new syntax when introducing it, especially Astro frontmatter, slots,
  typed props, import aliases, and React hydration directives.
- Run `npm run build` after implementation and report errors and warnings accurately.
  A successful build does not replace a separate TypeScript check.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
