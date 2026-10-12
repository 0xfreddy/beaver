#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Read-only APK inspection. Does not sign, upload, publish, or read private keys.
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
function fail(message) {
  throw new Error(message);
}
const apkArg = option('--apk');
const expected = option('--certificate-sha256')?.replaceAll(':', '').toLowerCase();
if (!apkArg || !expected?.match(/^[a-f0-9]{64}$/))
  fail(
    'Usage: node scripts/prepare-dapp-store.mjs --apk /absolute/release.apk --certificate-sha256 TRUSTED_RELEASE_CERT_SHA256 [--out /absolute/output]',
  );
const apk = resolve(apkArg);
const output = resolve(option('--out') ?? 'build/dapp-store');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) fail('Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK.');
const versions = readdirSync(join(sdk, 'build-tools'))
  .filter((x) => /^\d+\.\d+\.\d+$/.test(x))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
if (!versions.length) fail('Install Android SDK build-tools.');
const buildTools = join(sdk, 'build-tools', versions[0]);
function run(command, argv) {
  const result = spawnSync(command, argv, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0)
    fail(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
const certificate = run(join(buildTools, 'apksigner'), [
  'verify',
  '--verbose',
  '--print-certs',
  apk,
]);
const fingerprints = [
  ...certificate.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)/gi),
].map((m) => m[1].toLowerCase());
if (fingerprints.length !== 1 || fingerprints[0] !== expected)
  fail('APK signing certificate does not match the trusted release certificate.');
if (/CN=Android Debug/i.test(certificate))
  fail('Debug-signed APKs cannot be prepared as a store release.');
const badging = run(join(buildTools, 'aapt'), ['dump', 'badging', apk]);
const pkg = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
if (!pkg || pkg[1] !== 'com.beaver.app')
  fail('Expected production Android package com.beaver.app.');
if (/application-debuggable/.test(badging)) fail('The APK is debuggable.');
const manifest = run(join(buildTools, 'aapt'), ['dump', 'xmltree', apk, 'AndroidManifest.xml']);
const metadata = manifest
  .split(/E: meta-data/)
  .find((part) => part.includes('expo.modules.updates.ENABLED'));
if (!metadata || !/android:value[^\n]*\(type 0x12\)0x0\b/.test(metadata.split(/\n\s*E:/)[0]))
  fail('Expo Updates must be disabled for the reviewed dApp Store APK.');
if (!manifest.includes('solana-wallet')) fail('MWA Android wallet visibility query is missing.');
const entries = run('unzip', ['-Z1', apk]);
if (!entries.split('\n').includes('assets/index.android.bundle'))
  fail('Standalone JavaScript bundle missing.');
const fingerprint = expected.toUpperCase().match(/.{2}/g).join(':');
const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: pkg[1],
      sha256_cert_fingerprints: [fingerprint],
    },
  },
];
const report = {
  package: pkg[1],
  versionCode: Number(pkg[2]),
  versionName: pkg[3],
  certificateSha256: fingerprint,
  apkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  verified: [
    'release certificate',
    'production package',
    'non-debuggable',
    'embedded bundle',
    'OTA disabled',
    'MWA visibility',
  ],
  stillRequired: [
    'Confirm production Privy/API configuration and mock mode disabled',
    'Physical-device wallet deposit and withdrawal acceptance',
    'Publish assetlinks.json on https://trybeaver.app/.well-known/assetlinks.json',
    'Publisher portal identity verification, listing assets, release submission',
  ],
};
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'assetlinks.json'), JSON.stringify(assetlinks, null, 2) + '\n');
writeFileSync(join(output, 'release-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`APK checks passed. Release report and website association: ${output}`);
