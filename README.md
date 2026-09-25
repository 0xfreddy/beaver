<div align="center">

<img src="assets/logo.png" width="96" alt="Beaver" />

**built by [0xfreddy](https://x.com/freddy_0x)**

# Beaver

**Turn everyday purchases into stock investments.**

[![CI](https://github.com/0xfreddy/beaver/actions/workflows/ci.yml/badge.svg)](https://github.com/0xfreddy/beaver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111110.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-111110.svg)](CONTRIBUTING.md)
[![Expo SDK 57](https://img.shields.io/badge/Expo%20SDK-57-111010.svg)](https://expo.dev)

<!-- App Store URL still pending at launch -->
<a href="#-try-it"><img src="assets/app-store.svg" alt="Download on the App Store" height="52" /></a>
<a href="https://testflight.apple.com/join/u2B71KkZ"><img src="assets/testflight.png" alt="Join the TestFlight beta" height="52" /></a>

Beaver rounds up your everyday card purchases and invests the spare change
into fractional stock — [xStocks](https://xstocks.fi) and
[prestocks.io](https://prestocks.io) — automatically, settled on-chain.

</div>

---

<p align="center">
  <img src="assets/screenshots/home-dark.png" width="190" alt="Home with a roundup gauge" />
  <img src="assets/screenshots/portfolio-dark.png" width="190" alt="Portfolio of fractional shares" />
  <img src="assets/screenshots/rules-dark.png" width="190" alt="Choosing your roundup rule" />
</p>

**TL;DR:** connect any bank — 1,400+ institutions supported — or a crypto card
([ether.fi](https://ether.fi), [Tuyo](https://www.tuyo.com)). Beaver detects
your purchases, rounds up the spare change, and gets you stock — every roundup
is routed on-chain through [Jupiter](https://jup.ag).

## 🔌 Integrations

| Logo | Integration | What Beaver uses it for |
| :--- | :--- | :--- |
| 🏦 | **Banking connection** | Link any bank from 1,400+ supported institutions — purchases are detected automatically. |
| <a href="https://xstocks.fi"><img src="assets/integrations/xstocks.png" alt="xStocks" height="28" /></a> | **[xStocks](https://xstocks.fi)** | Tokenized public stocks, each backed 1:1 by a real share — the fractional stock your roundups buy. |
| <a href="https://prestocks.io"><img src="assets/integrations/prestocks.png" alt="PreStocks" height="28" /></a> | **[PreStocks](https://prestocks.io)** | Tokenized pre-IPO shares of private companies. |
| <a href="https://ether.fi"><img src="assets/integrations/etherfi.png" alt="ether.fi" height="28" /></a> | **[ether.fi](https://ether.fi)** | Crypto card — connect it as a roundup source and cash withdrawals out to it. |
| <a href="https://www.tuyo.com"><img src="assets/integrations/tuyo.png" alt="Tuyo" height="28" /></a> | **[Tuyo](https://www.tuyo.com)** | Self-custodial USDC card — spend on it and Beaver rounds up the change. |
| <a href="https://jup.ag"><img src="assets/integrations/jupiter.png" alt="Jupiter" height="28" /></a> | **[Jupiter](https://jup.ag)** | On-chain swap routing — each roundup executes as a USDC → xStocks swap. |

## 📱 Try it

| Release channel | Version | Description | Link |
| :--- | :--- | :--- | :--- |
| Production | v0.1.0 | The same build as Beaver on the App Store. | 🚧 coming soon |
| TestFlight | latest | Public beta — newest features, may contain bugs. | [Join the beta](https://testflight.apple.com/join/u2B71KkZ) |
| **Run locally** | — | **The full app in mock mode** — no keys, no backend. | [Build it yourself ↓](#-build-it-yourself) |

## ✨ What it does

- 💳 **Roundups** — connect a card, and every purchase rounds up into your portfolio
- 📈 **Fractional stock** — spare change flows into tokenized stocks and pre-IPO shares (xStocks, PreStocks), settled on-chain
- 👥 **Social** — invite friends with codes, climb leaderboards, keep your identity to an alias
- 💸 **Withdrawals** — cash out to your own crypto card, gated by Face ID and jurisdiction checks
- 🌗 **Native feel** — Liquid Glass on iOS 26, dark mode, haptics, and an offline mock account

## 🔓 What's open, what's not

This repository contains Beaver's **mobile client**. The account service it
talks to — roundup decisions, bank sync, execution, withdrawals — is a
separate, closed-source backend. That means everything here builds and runs
**with zero API keys and zero backend** against the built-in mock engine, and
money-moving logic never ships in this repo. Details and diagrams:
[docs/architecture.md](docs/architecture.md).

## 🔨 Build it yourself

**Prerequisites:** Node ≥ 22.13, pnpm 11 (`corepack enable`), and Xcode or
Android Studio for native builds. Web runs with nothing but Node.

```sh
git clone https://github.com/0xfreddy/beaver.git
cd beaver
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile        # press i (iOS), a (Android), or w (web)
```

Once it's running you can:

1. Browse a full sample account — purchases, roundups, portfolio, performance
2. Connect and disconnect the mock bank link
3. Tune your roundup rules and watch the math update
4. Invite friends, rename your alias, and climb the leaderboard
5. Request a withdrawal to a crypto card (devnet, simulated end to end)

You need **zero API keys** for all of the above. Live sign-in and real data
require Privy and API credentials we can't share, so design changes to work in
mock mode.

#### Use your own API tokens

Good news: **you don't need any.** The app runs fully in mock mode out of the
box — that is the default development experience. If you want live sign-in or
telemetry, these are the knobs:

| Name | Service | Url | Comments |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_PRIVY_APP_ID` / `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Privy auth | <https://privy.io> | Only for live sign-in. Mock mode needs none. |
| `EXPO_PUBLIC_API_URL` | Account service | — | Mock mode intercepts it; defaults to `http://localhost:3000`. |
| `EXPO_PUBLIC_SOLANA_NETWORK` | Solana cluster | <https://solana.com> | `devnet` by default; production builds pin `mainnet`. |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry | <https://sentry.io> | Optional. |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog analytics | <https://posthog.com> | Optional. We never track PII. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Your own EAS project | <https://expo.dev> | Optional — only for OTA updates on a fork. |

Full reference: [docs/build.md](docs/build.md).

## 🧱 Architecture

Expo (SDK 57) + React Native, TypeScript strict throughout, three workspaces:
the app (`apps/mobile`), the shared contracts (`packages/types`), and the pure
roundup math (`packages/domain`). The closed service sits behind an HTTPS API
validated by those shared contracts. Map and data flow:
[docs/architecture.md](docs/architecture.md).

## 🔬 Tests

Unit tests run on [Vitest](https://vitest.dev) — check out the `*.test.ts`
files colocated with the source. Coverage is strongest in the roundup math and
the mobile data layer; the UI layer isn't covered yet and E2E (Maestro against
mock mode) is on the roadmap. We hold merged code to `pnpm check` and prefer a
small test that explains *why* it exists. Guide: [docs/testing.md](docs/testing.md).

## 🙋 Contribute

If you find a bug, or if you have an idea for Beaver, please
[file an issue](https://github.com/0xfreddy/beaver/issues) — we really appreciate
feedback and input! For code contributions, start with
[CONTRIBUTING.md](CONTRIBUTING.md): setup, code style, and the PR checklist
(including per-platform QA). For vulnerabilities, follow [SECURITY.md](SECURITY.md)
instead of opening a public issue.

## 📰 License

The client code is [MIT licensed](LICENSE). The Beaver name, logo, and
illustration assets are **not** covered by MIT — fork the code, replace the
branding. Fonts ([Faculty Glyphic](https://fonts.google.com/specimen/Faculty+Glyphic),
Inter) are under the SIL Open Font License — see
`apps/mobile/assets/licenses/`.

## ⭐ Credits

Built with [Expo](https://expo.dev). UI inspiration from
[reacticx](https://github.com/rit3zh/reacticx). Made with ❤️ by the Beaver
team and [contributors](https://github.com/0xfreddy/beaver/graphs/contributors) —
PRs welcome!
