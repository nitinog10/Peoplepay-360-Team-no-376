# Next.js 16 notes for PeoplePay360's frontend

Read from the docs shipped inside the installed package — `frontend/node_modules/next/dist/docs/` —
as `frontend/AGENTS.md` requires. Paths below are relative to that directory so they can be re-read
against whatever version is installed. Installed here: **next 16.3.4, react 19.2.8** (`frontend/package.json`).

Only the deltas that change how *we* write code are recorded. Anything not listed behaves the way the
App Router did in 15.

## Routing and layouts

`01-app/01-getting-started/03-layouts-and-pages.md`

- `app/layout.tsx` is required and must render `<html>` and `<body>`. Nested `layout.tsx` files wrap
  children and **keep state across navigation** — the app shell (sidebar, topbar, attendance widget)
  belongs in `app/(app)/layout.tsx` so a punch in the header survives every route change.
- **`params` and `searchParams` are Promises.** Synchronous access was removed in 16, not deprecated:
  `const { id } = await params`. Same for `cookies()`, `headers()`, `draftMode()`
  (`01-app/02-guides/upgrading/version-16.md` § Async Request APIs).
- `PageProps<'/route'>` and `LayoutProps<'/route'>` are **global** types — no import. They are generated
  by `next dev`, `next build` or `next typegen`, so a fresh clone must run one of those before
  `tsc --noEmit` will resolve them. Use `PageProps<'/attendance/[date]'>` instead of hand-writing
  `{ params: Promise<{ date: string }> }`.
- Client Components read the query string with `useSearchParams()`; only a Server Component page gets the
  `searchParams` prop. Our `DataTable` syncs `page/pageSize/sort/order/q` to the URL from the client, so
  it uses `useSearchParams()` + `router.replace()`.

## Route groups, private folders

`01-app/01-getting-started/02-project-structure.md` (§ Route groups, § Private folders)

- `(group)` folders organise routes **without appearing in the URL** — `app/(auth)/login/page.tsx` serves
  `/login`, `app/(app)/employees/page.tsx` serves `/employees`. That is how the authenticated shell wraps
  every screen except login.
- A second root layout is only created by deleting the top-level `app/layout.tsx` and giving each group its
  own `<html>`/`<body>`. We keep one root layout, so `(auth)` and `(app)` layouts must **not** emit
  `<html>`/`<body>`.
- `_folder` is never routable. Not needed for colocation (non-`page`/`route` files are already safe), but
  useful if we colocate scratch files under `app/`.

## Data fetching and caching

`01-app/01-getting-started/08-caching.md` · `01-app/02-guides/caching-without-cache-components.md` ·
`01-app/02-guides/client-side-data-fetching/tanstack-query.md`

- The `use cache` / `cacheLife` / `cacheTag` model documented in `08-caching.md` is **opt-in** behind
  `cacheComponents: true` in `next.config.ts`. We have **not** enabled it (`frontend/next.config.ts` is
  empty), so none of `use cache`, `cacheLife`, PPR or the "blocking-route" dev insights apply to us. If we
  ever turn it on, read `01-app/02-guides/migrating-to-cache-components.md` first — the flag surfaces build
  errors for any uncached read that is not inside `<Suspense>`.
- Our data lives behind an **external Express API on :8000** and every call needs an access token that is
  held in memory only. That rules out server-side fetching: pages are Client Components and all reads go
  through TanStack Query. Next's own `fetch` cache never sees our traffic.
- Provider shape is straight from `tanstack-query.md` § Set up the provider — a new `QueryClient` per server
  render, one memoised client in the browser:

  ```tsx
  let browserQueryClient: QueryClient | undefined
  function getQueryClient() {
    if (typeof window === 'undefined') return new QueryClient()
    browserQueryClient ??= new QueryClient()
    return browserQueryClient
  }
  ```

  Sharing one module-level client across server renders leaks one user's data into another's HTML.
- `queryOptions()` keeps a query key and its fetcher in one exported object (`tanstack-query.md`
  § Provide initial data) — that is the pattern `lib/api/<module>.ts` follows so a screen never re-declares
  a key.
- `useSuspenseQuery` throws to the nearest error boundary and, after first success, keeps stale data
  rendered instead of re-showing the fallback (use `isFetching` for the refresh hint). We prefer plain
  `useQuery` so the table can own its skeleton/empty/error states.

## Middleware is now `proxy.ts`

`01-app/01-getting-started/16-proxy.md` · `01-app/02-guides/upgrading/version-16.md` § `middleware` to `proxy`

- The file is `proxy.ts` at the project root (beside `app/`), exporting `proxy` — `middleware.ts` and the
  `middleware` export are deprecated. One file per project; `config.matcher` filters paths.
- Its runtime is **`nodejs` and cannot be configured**; the `edge` runtime is not supported in `proxy`.
- Config flags were renamed with it: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.
- The doc is explicit that proxy is "**not** intended for … full session management or authorization" — only
  optimistic redirects. **We add no `proxy.ts`**: our access token never reaches a cookie the server can
  read (only the httpOnly `pp360_refresh` cookie, scoped to `/api/v1/auth` on :8000, which never rides
  along to :3000). Auth gating therefore lives in `SessionProvider` + the `(app)` layout, client-side.
  `01-app/02-guides/authentication.md` § Optimistic checks with Proxy is the pattern we are deliberately
  not using.

## Styling

`01-app/01-getting-started/11-css.md` § Tailwind CSS

- Tailwind 4 has no `tailwind.config.js` here: `postcss.config.mjs` loads `@tailwindcss/postcss`,
  `app/globals.css` starts with `@import 'tailwindcss'`, and design tokens are declared in CSS with
  `@theme`. That is already the shape of the boilerplate — extend `globals.css`, don't add a JS config.
- Turbopack does **not** support the legacy `~` prefix in Sass/CSS `@import`s
  (`01-app/02-guides/upgrading/version-16.md` § Sass node_modules imports). Import bare package paths.

## Deprecations and removals that touch this repo

`01-app/02-guides/upgrading/version-16.md` § Removals

- **`next lint` is gone** and `next build` no longer lints. `frontend/package.json` already uses
  `"lint": "eslint"`, and `eslint.config.mjs` is flat config — `@next/eslint-plugin-next` defaults to flat
  config now. Lint is a separate gate from build; run both.
- **Turbopack is the default** for `next dev` *and* `next build`; no `--turbopack` flag. A stray `webpack`
  key in `next.config.ts` would fail the build (`--webpack` opts out). `turbopack` is a top-level config
  key now, not `experimental.turbopack`.
- `next dev` and `next build` write to **separate output directories** (`.next/dev` vs `.next`), so the dev
  server can stay up while we run the build gate. A lockfile stops two `next dev` instances.
  `.gitignore` already ignores `/.next/`.
- `serverRuntimeConfig` / `publicRuntimeConfig` are **removed** — client-visible config must be
  `NEXT_PUBLIC_*`. `NEXT_PUBLIC_API_URL` in `.env.local` is the API base URL; it is inlined at build time.
- `revalidateTag(tag)` now requires a second `cacheLife` argument, `next/legacy/image` and `images.domains`
  are deprecated, AMP is removed, parallel-route slots require an explicit `default.js`. None of these are
  in use here — listed so nobody reintroduces them from memory.
- React 19.2 ships with it: `useEffectEvent`, `<Activity>`, View Transitions are available. The React
  Compiler is stable but **off** by default (`reactCompiler: true` + `babel-plugin-react-compiler`); leaving
  it off keeps builds fast, so memoise by hand where it matters.
- Next 16 no longer overrides `scroll-behavior` during navigation. If we set `scroll-behavior: smooth`
  globally, add `data-scroll-behavior="smooth"` to `<html>` or route changes stop jumping to the top.

## Housekeeping

- `next dev` writes and re-adds the `<!-- BEGIN:nextjs-agent-rules -->` block in `frontend/AGENTS.md`
  (`01-app/02-guides/upgrading/version-16.md` § Set up AI agent docs). Ours is already current, so a dev run
  leaves the tree clean — but if someone strips or edits that block it will reappear in `git status`; commit
  it with the work instead of reverting it.
- Telemetry is on by default and prints a notice on first `next dev`; `npx next telemetry disable` if we
  care.


