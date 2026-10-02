# najafov.dev

This is the source of my personal site. I'm a backend engineer looking for my next role, remote or with relocation, and I wanted the site to show how I work rather than tell you about it. The plan is a site you can ask about me, out loud, and that answers from my CV and my projects with the sources on screen, in my own voice.

It isn't there yet. Right now it's the skeleton: a Next.js site, a NestJS API, and a content package that checks everything the site says about me before anything gets built.

## How the content works

Everything the site says about me lives in `content/` as YAML, and nothing reads those files at runtime. `content/src/cli.ts generate` loads them, validates them with zod and writes one typed module that both the site and the API import. A missing field, a broken link format or a key I didn't plan for fails the build with the file and the path, instead of showing up as a blank on the page. I chose a generated module over reading files on request because the Next build bundles the site and the API runs from compiled output, and neither should depend on where the YAML happens to sit on disk.

The CLI runs straight from TypeScript on Node 24, without a build step of its own, so the content package only uses syntax Node can strip.

## Running it

You need Node 24 and pnpm 11.

```bash
pnpm install
pnpm dev          # site on http://localhost:3200, API on http://localhost:3201
pnpm test
pnpm typecheck
pnpm build
```

`pnpm --filter @portfolio/content validate` checks the content without building anything.

## Layout

```
apps/web     Next.js site
apps/api     NestJS API
content/     what the site says about me, plus the schema, loader and generator
```
