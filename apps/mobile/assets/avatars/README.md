# Bundled profile avatars

The first five choices are Beaver line-art portraits supplied for the product. Their original
transparent artwork is rendered onto a neutral graphite circle so it remains legible in both app
themes and in the native tab bar. `import-beaver-pfps.swift` generates the 384px profile image and
28/56/84px tab variants from a directory containing exactly five PNGs.

The Beaver portraits intentionally retain the stored IDs `glass-01` through `glass-05` so existing
profiles and the database avatar constraint remain compatible. The remaining choices use the
DiceBear Glass set described below.

12 curated variants were generated 11 September 2026 with `@dicebear/core` and `@dicebear/glass` **9.2.4**, then rasterized with Sharp. Seven remain available in the picker. Glass is by DiceBear, licensed **CC0 1.0**: https://creativecommons.org/publicdomain/zero/1.0/ . Official style: https://www.dicebear.com/styles/glass/ . DiceBear implementation packages are MIT licensed; no implementation dependency ships in the app.

`manifest.json` records every fixed seed and palette option. These seeds are original static strings, never account identifiers. SVG masters preserve provenance; native/UI PNGs are 384px and tab PNGs are 28/56/84px at 1x/2x/3x, with transparent circular corners. Native tabs use `renderingMode="original"` and a base asset reference so Metro selects scale correctly. No remote render request and no DiceBear code executes on Hermes. `glass-12` is the neutral graphite fallback for an unknown stored avatar ID; a new profile starts at `glass-01`.

Reproduce with build-only dependencies, outside the app runtime:

```sh
mkdir -p /tmp/roundups-avatar-build
npm install --prefix /tmp/roundups-avatar-build @dicebear/core@9.2.4 @dicebear/glass@9.2.4 sharp
cp apps/mobile/assets/avatars/generate.mjs /tmp/roundups-avatar-build/generate.mjs
node /tmp/roundups-avatar-build/generate.mjs "$PWD/apps/mobile/assets/avatars"
```

Names and IDs in `src/lib/avatars.ts` map to the bundled files. Preserve IDs during the Phase 2 migration. Glass gradients are the PRD's explicit exception to the neutral app palette; they are not tappable decorative spin art.
