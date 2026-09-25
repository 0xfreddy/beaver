# Contributing to Beaver

Thanks for helping build Beaver's mobile client. This guide covers setup,
code style, and what a pull request needs before it can merge.

## Setup

```sh
corepack enable            # provides pnpm 11
git clone https://github.com/__REPO__.git
cd beaver
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile            # Expo dev client; press i/a for native, w for web
```

No API keys are required. The app runs in **mock mode**: a built-in engine
serves a sample account (purchases, roundups, friends, withdrawals) from
local storage, so every screen works without the closed-source backend.
Live sign-in and real data need Privy and API credentials that we cannot
share — design your changes so they work in mock mode.

## Daily commands

| Command | What it does |
|---|---|
| `pnpm dev:mobile` | Start the Expo dev client |
| `pnpm typecheck` | TypeScript, strict, across all workspaces |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Vitest unit tests |
| `pnpm check` | All three — the CI gate; run before pushing |
| `pnpm mobile:export` | Export iOS/Android/web bundles (smoke build) |

## Where things live

```
apps/mobile/src/app          Screens (expo-router file routes)
apps/mobile/src/components   UI components, including the reacticx/ design system
apps/mobile/src/lib          Data layer: api client, mock engine, domain helpers
apps/mobile/src/providers    App-wide providers (auth, theme, data)
apps/mobile/src/theme        Design tokens
packages/types               Zod contracts shared with the account service
packages/domain              Pure roundup math — integer cents, no I/O, fully tested
```

If you fork: replace the Beaver name, icon, illustrations, and analytics IDs —
the branding is not MIT-licensed, and reviews must not look like our store
listing.

## Code style

- TypeScript in `strict` mode with `noUncheckedIndexedAccess`. Types are the
  first line of defense; avoid `any` and non-null assertions.
- Prettier formats, ESLint lints (including react-hooks rules and a
  complexity cap on logic). `pnpm lint` must be clean.
- Match the file you are editing: naming, comment density, and patterns vary
  a little between the UI and the data layer.

## Tests

Tests are colocated (`*.test.ts` next to the source) and run under Vitest.

- Pure logic (roundup math, parsers, reducers) belongs in a test — the
  `packages/domain` suite is the model to copy.
- For UI changes, a short recording or screenshots in the PR are worth more
  than a brittle component test.
- When you write a test, say **why** it exists (the behavior being pinned),
  not just what it does. A comment explaining the regression a test guards
  against is always welcome.

## Pull requests

1. Open an issue first for anything beyond a small fix, so we can align on
   the approach.
2. `pnpm check` must pass — CI runs the same gate.
3. Fill in the PR template: what changed, screenshots/recordings for UI work,
   and what you tested.
4. Keep PRs focused; one concern per PR lands faster.

## Reporting bugs

Use the bug report issue template. Include the app version, platform
(iOS/Android/web), and repro steps in mock mode where possible. Screenshots
or recordings help a lot.

## Security

Do not open issues for vulnerabilities — follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your contributions are licensed under the
[MIT license](LICENSE) that covers this repository.
