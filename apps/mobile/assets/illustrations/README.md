# Roundups illustration family

Original artwork generated with the built-in image-generation tool on 9 September 2026. These are production assets, not screenshots or artwork copied from the Appllama references. The authenticated Blank Spaces study informed the restrained monochrome sculptural direction and surrounding screen composition.

| File                  | Narrative                                     | In-app placement                                          |
| --------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `roundup-orbit.png`   | Small parts becoming a whole                  | Welcome, account options, empty portfolio                 |
| `everyday-change.png` | Small change from everyday purchases          | Second welcome chapter, alongside native exact arithmetic |
| `everyday-change-transparent.png` | Transparent coffee-and-token card cutout | Home “Choose when” carousel card in light and dark mode |
| `your-choice.png`     | A deliberate action that has not happened yet | Final welcome chapter and manual-control explanation      |

Each original is a 1280 × 1280 PNG. They are bundled through static React Native image requires, with no remote image dependency. The originals retain their detail (approximately 2.3 MB combined); delivery-size optimization remains a release task. Artwork is decorative because adjacent native text conveys its meaning. Financial amounts, disclosures and controls remain native accessible text. Dark appearance blends into the black canvas; light appearance uses an intentional black gallery panel. Reduce Motion removes the entrance translation.

## Prompt set

Generation mode: built-in `image_gen.imagegen`, three separate images, no external API key. The following records the shared art direction and composition instructions used for this family.

Shared direction: Original production illustration for Roundups, an Expo iOS app. Artwork only, not a UI mockup. Restrained editorial sculptural storytelling inspired by the visual vocabulary of Blank Spaces. Pure black background with generous negative space. Neutral black, graphite, silver and white only. Satin brushed metal, soft upper-left white key light, restrained rim light, clean silhouettes. No text, logos, numerals, watermarks, arrows, charts, neon or promises of wealth. No reference screenshot copied into the product.

### Roundup orbit

An open brushed-silver circular ring in a slight three-quarter view. A small detached silver arc hovers above the gap. Three thin concentric graphite contours recede inside the main ring. The object occupies roughly 65 percent of the square, with generous black margins. The image represents separate small amounts coming together without implying financial growth.

### Everyday change

A graphite takeaway coffee cup with a brushed-silver lid and a blank silver token beside it. Thin elliptical contours connect the composition. Use the same satin graphite/silver materials, lighting and black background as the orbit. No brand, dollar sign or lettering. The native screen supplies the arithmetic separately.

The dashboard carousel uses `everyday-change-transparent.png`, a built-in image-editing pass that removes only the opaque black backdrop while preserving the cup, token, lighting, materials, composition and elliptical contours. This lets the native card surface show through in both appearances.

### Your choice

An anatomically plausible sculpted right hand entering from the upper right, with its index finger hovering above a blank silver token inside a single thin ellipse. Keep a visible gap between finger and token: the action has not happened. The other fingers curl naturally. Graphite and brushed-silver surfaces, matching the first two illustrations. No financial symbols or implied execution.

## Dashboard card additions — 10 September 2026

Generated with the built-in image-generation tool, one independent call per original asset. Both 1280-square PNGs retain real alpha transparency, so card surfaces show through in light and dark mode.

- `wallet-token.png`: Available USDC card indicator. Prompt: Original production dashboard asset for Roundups Expo iOS: a substantial brushed-silver blank token leaning against a thin charcoal wallet-like folded metal sleeve, three-quarter view. Restrained premium sculptural editorial style, monochrome silver/graphite/white, soft upper-left key light, precise satin metal, smooth edges. Transparent alpha background; no floor plane, opaque backdrop or glow. Compact composition occupying 80% of a square, fully in frame with margins, silhouette readable at 64 px. No text, numbers, logos, dollar signs or watermark. Match the existing silver open-ring and coffee sculptures; asset only, not UI.
- `activity-receipt.png`: Activity card indicator and enlarged cropped background detail. Prompt: Original sculptural curled receipt strip made from pale satin silver, embossed short graphite horizontal grooves instead of readable text, beside a small graphite blank token. Gently folded lower edge and subtly serrated top. Brushed silver/graphite, soft upper-left studio light, restrained monochrome editorial 3D style matching the existing sculptures. Transparent alpha background; no floor plane, opaque rectangle or glow. Square composition filling 80%, entirely in frame with margins, readable as a small indicator or right-aligned card background. No text, numbers, currency signs, logos, watermark, figures, UI or charts.

The redemption gauge is native vector-like geometry made from positioned views. It represents the pending amount divided by the redemption minimum, with a separate per-market-minimum disclosure. It is not a generated image, financial score or return projection.
