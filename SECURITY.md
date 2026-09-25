# Security policy

## Scope

This repository contains Beaver's **mobile client** — UI, navigation, state,
and the local mock engine. The hosted account service (bank connections,
roundup execution, withdrawals) is closed source and **out of scope for this
repository's code review**, but reports about how the client interacts with it
are in scope.

In scope:

- Anything in this repository: the app client, mock engine, and shared
  contract types.
- Client-side handling of credentials, tokens, and deep links.
- Misuse of client APIs that could affect other users (e.g. through invite or
  social features).

Out of scope:

- The hosted backend service and its infrastructure.
- Volumetric abuse, DoS, or automated scraping of public endpoints.
- Reports from automated scanners without a demonstrated impact.
- Best-practice suggestions that do not represent an exploitable issue.

## Reporting a vulnerability

Email **security@trybeaver.app** with details: affected version, platform,
reproduction steps, and impact. Do not open a public issue or publish an
exploit before we have responded.

We aim to acknowledge reports within 72 hours and will keep you posted on
remediation timing. Coordinated disclosure: please wait until the fix ships
before publishing.

There is no bug bounty program today; reports are credited on request.

## Safe harbor

Good-faith research that respects user privacy, avoids service degradation,
and follows this policy is welcome and will not result in legal action.
