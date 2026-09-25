# Testing

## Commands

```sh
pnpm test           # Vitest, all workspaces
pnpm --filter @roundups/domain test       # one workspace
corepack pnpm vitest run apps/mobile/src/lib/api.test.ts   # one file
```

Tests are colocated with source as `*.test.ts` and run under
[Vitest](https://vitest.dev) with a 15-second timeout.

## What is covered today

- **`packages/domain`** — the roundup math: integer-cent rounding, decision
  rules, thresholds, and historical previews. This suite is the model for
  pure-logic testing in the repo.
- **`apps/mobile/src/lib`** — the data layer: API client behavior (error
  mapping, URL validation), the mock engine's scenario transitions,
  withdrawal/allocation helpers, and ticker search.
- **`packages/types`** — contract schemas.

Not covered yet: component/UI tests and end-to-end flows. UI changes are
reviewed with recordings in the PR (see the PR template), and an E2E layer
(Maestro against mock mode) is on the roadmap.

## Writing tests

- Test behavior, not implementation. If a test breaks on a safe refactor, it
  was testing the wrong thing.
- Say **why** the test exists — a one-line comment pinning the regression or
  invariant being guarded is worth more than a long assertion list.
- Prefer pure functions and extractability over mocking frameworks. The
  existing suites mock almost nothing.
- Keep runtime fast: the whole suite runs in seconds; keep it that way.

CI (`pnpm check`) runs typecheck, lint, and the full suite on every pull
request, plus a bundle export of all three platforms.
