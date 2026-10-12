# Solana Mobile integration

Beaver uses **Mobile Wallet Adapter (MWA)** on Android to deposit USDC from an
installed compatible wallet into the user's existing **Privy embedded Solana
wallet**. Privy continues to own sign-in, the account wallet and authorized
automated roundups. The external wallet approves only the deposit transfer.

## Run the source

Follow [build.md](build.md). The default sample account runs without API keys or
the private backend. Its deposits are simulated; it does **not** open an external
wallet or send funds. iOS and web retain the address/QR funding flow.

With no Privy credentials, eligible mock builds open a sample session automatically.
Use `GR8F` at the sample invite step; it is handled locally. This fallback is
disabled in production and whenever mock mode is disabled.

For live Android deposits, configure a Privy React Native client and reachable
Beaver account service, set `EXPO_PUBLIC_MOCK_DATA_ENABLED=false`, and ensure
`EXPO_PUBLIC_SOLANA_NETWORK` matches the service (`mainnet` or `devnet`). Register
your Android package and URL scheme in Privy. The production package is
`com.beaver.app`; development uses `com.beaver.app.development` with scheme
`roundups-development`. Rebuild after installing dependencies:

```sh
pnpm install --frozen-lockfile
cd apps/mobile
pnpm exec expo run:android --device
```

MWA needs a native build and an installed MWA-compatible wallet; Expo Go is not
supported. In **Feed Beaver → USDC → Deposit from wallet**, enter an amount and
continue to the wallet. Review the transfer there, approve, then return to Beaver.
The source wallet needs USDC plus enough SOL for the fee and, when necessary,
creation of the destination USDC token account.

`EXPO_PUBLIC_SOLANA_RPC_URL` optionally selects an HTTPS RPC. It is embedded in
the application: use a client-safe endpoint, never a server credential. Its
genesis hash must match the selected network. Public cluster endpoints are the
fallback and may rate-limit; configure a suitable endpoint for a live demo.

## Technical path

- Android entrypoint supplies the Buffer polyfill before loading Solana code.
- The config plugin makes `solana-wallet:` wallets visible to Android.
- `src/lib/mobile-wallet-client.android.ts` uses the official MWA protocol and
  web3.js wrapper. Wallet authorization is separate from Privy login; no external
  wallet authorization token is persisted. Each new deposit opens a wallet session.
- Before signing, `/v1/funding` must identify the same Privy destination, cluster,
  known USDC mint and six decimals. The existing endpoint enforces account eligibility.
- The transaction contains only idempotent recipient ATA creation and an SPL
  `TransferChecked`. Amounts use integer base units. The source wallet pays fees.
- Beaver checks the returned message and signature, stores the signed transaction
  **before** broadcasting, and recovers it across app restarts. Retries send the
  exact same bytes/signature. A new transfer is blocked until the previous one
  finalizes, fails with finality, or expires without a recorded signature.
- RPC errors and wallet approval never imply that a deposit succeeded. The app
  checks signature finality; the account service independently verifies finalized
  transfer receipts before accounting for the deposit. Existing automation is unchanged.

The current funding implementation uses the external wallet's associated USDC
token account and a wallet supporting MWA `signTransactions`.

## APK profiles

```sh
cd apps/mobile
# Standalone live mainnet APK, with the configured Privy/account service:
pnpm android:apk
# Public snapshot only: standalone sample account APK, no real transfers:
pnpm dlx eas-cli@latest build --platform android --profile android-demo
```

`hackathon` explicitly produces an **APK**, disables the development client,
disables sample/internal accounts, and disables OTA updates to keep the submitted
binary fixed. Configure the production EAS environment with your Privy app/client
IDs and client-safe RPC endpoint. Forks must link their own EAS project and use
their own package registration. `android-demo` is for source reproducibility and
UI evaluation; it is **not evidence of live Solana interaction**.

## Verification before submission

Run the app typecheck and the `mobile-wallet-deposit.test.ts` tests. Then install
the signed standalone APK on a **physical Android phone** and record:

1. Clean installation and launch without Metro; successful Privy sign-in.
2. Opening the funding screen and selecting an installed compatible wallet.
3. Cancelling wallet connection and transfer approval, then retrying.
4. Insufficient USDC/SOL, network failure, and returning from wallet approval.
5. A small approved USDC deposit with its Solana Explorer signature and finalized
   receipt; verify the recipient is the same Privy wallet shown in Beaver.
6. Force-closing after approval and reopening: recover the same transfer, with no
   duplicate send. Test light/dark, large text, keyboard dismissal and Android back.

Use Devnet test tokens for development where possible. Devnet stock trades in
Beaver's private service are paper-settled, so show a real USDC transfer separately
and label paper investments accurately. The public mock client does not reproduce
the private execution engine.

A signed build-5 APK is linked in the [README](../README.md). Physical-device
evidence, the demo/presentation and store submission remain outstanding. See
[release notes](releases/2026-10-12.md) for the precise validation boundary.

References: [Solana Mobile React Native integration](https://docs.solanamobile.com/get-started/react-native/invoke-mwa-sessions-directly),
[compatible wallets](https://wallets.solanamobile.com/).


## Verified withdrawal destinations

On Android, Withdraw offers **Use my wallet** for live accounts. Mobile Wallet Adapter signs an exact server-issued message; the authenticated API checks the Ed25519 signature, account, address, network and ten-minute expiration. A proof is consumed transactionally for one withdrawal, while idempotent retries return the existing receipt. Editing the address clears the verified label. Manual addresses remain available for recipients such as exchanges that cannot sign messages. Privy still signs the withdrawal after normal review and approval.

Sample mode never opens a live wallet or fabricates verification. A self-hosted service implementing the challenge/verify endpoints and proof consumption is required for this feature; the source snapshot does not include Beaver's private backend. The public API contracts document those endpoints. Tests cover message binding, cancellation, changed accounts and mismatched responses.

## dApp Store release

`pnpm --filter @roundups/mobile android:dapp-store` builds the dedicated production APK profile after configuring your own EAS project, production Privy credentials, backend, Android package and release signing identity. The profile disables sample mode and OTA updates. Beaver's maintainer release-check command expects `com.beaver.app`; forks must choose their own package and adjust that expectation.

From `apps/mobile`, use `pnpm android:dapp-store:prepare --apk /absolute/release.apk --certificate-sha256 TRUSTED_RELEASE_CERT_SHA256` with Android SDK/Java installed and `ANDROID_HOME` configured. It validates the release certificate and APK structure and produces a release report plus a Digital Asset Links statement. Merge the statement into the identity website's `/.well-known/assetlinks.json`; configure your fork's own MWA identity domain. This command does not upload or publish anything.

First publication also needs a publisher account, KYC/KYB, publisher wallet, listing assets, a real-device acceptance pass, and a signed release submission through the [Solana dApp Publisher Portal](https://publish.solanamobile.com). See the [official first-submission guide](https://docs.solanamobile.com/dapp-store/submit-new-app). No production APK, store approval, or physical-wallet test is implied by the sample build.

## Install the submission APK

1. Open the Android / Solana Mobile APK link in the [README](../README.md) on
   the phone and download it.
2. Allow installation from that browser when Android prompts, then install Beaver.
3. Open Beaver without Metro and sign in. This binary uses live mainnet accounts;
   use the public source in mock mode for an evaluation without funds or credentials.
4. For wallet flows, install a wallet supporting MWA and the selected Solana network.

The APK has the same package and release signer as the normal Android variant.
Android may refuse an update from an installation signed with a different key.
Back up any needed local data before uninstalling a conflicting installation.
Physical Seeker/Saga acceptance has not yet been recorded; do not treat APK
build verification as a completed device test or dApp Store approval.
