import type { DiaGradient } from './types';

export function buildSweepGradient(
  width: number,
  band: number,
  sweepColors: readonly string[],
  baseColor: string,
): DiaGradient {
  const total = width * 2 + band;
  const bandStart = width / total;
  const bandEnd = (width + band) / total;
  const colors: string[] = [baseColor, baseColor];
  const locations: number[] = [0, bandStart];
  const count = sweepColors.length;

  sweepColors.forEach((color, index) => {
    const position =
      count === 1
        ? (bandStart + bandEnd) / 2
        : bandStart + (index / (count - 1)) * (bandEnd - bandStart);
    colors.push(color);
    locations.push(position);
  });

  colors.push('transparent', 'transparent');
  locations.push(bandEnd, 1);
  return { colors, locations };
}

export function sweepStripWidth(width: number, band: number) {
  return width * 2 + band;
}
