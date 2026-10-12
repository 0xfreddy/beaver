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

- **Mobile components and providers** — selected rendering/state regressions,
  onboarding, bank picker, notifications, achievements and wallet flows.
- **Solana Mobile** — amount validation, deposit recovery/finality, message binding,
  cancellation, changed wallet accounts and withdrawal-destination responses.

Automated checks do not establish physical-device wallet behavior. Native
back/sheet gestures, biometric prompts, wallet handoff and real finalized
transfers require device acceptance. See [Solana Mobile](solana-mobile.md).

## Writing tests

- Test behavior, not implementation. If a test breaks on a safe refactor, it
  was testing the wrong thing.
- Say **why** the test exists — a one-line comment pinning the regression or
  invariant being guarded is worth more than a long assertion list.
- Prefer pure functions and extractability over mocking frameworks. Mock native boundaries only where needed.
- Keep runtime fast: the whole suite runs in seconds; keep it that way.

CI (`pnpm check`) runs typecheck, lint, and the full suite on every pull
request, plus a bundle export of all three platforms.
