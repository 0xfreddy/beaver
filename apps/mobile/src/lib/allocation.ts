/** Geometry only. Amounts remain integer cents and are never rounded for allocation. */
export function allocationSegments(
  markets: readonly { symbol: string; amountCents: number }[],
  trailingSymbols: readonly string[] = [],
) {
  const trailingOrder = new Map(trailingSymbols.map((symbol, index) => [symbol, index]));
  const positive = markets
    .map((market, index) => ({ market, index }))
    .filter(({ market }) => market.amountCents > 0)
    .sort((a, b) => {
      const aTrailing = trailingOrder.get(a.market.symbol);
      const bTrailing = trailingOrder.get(b.market.symbol);
      if (aTrailing === undefined && bTrailing === undefined) return a.index - b.index;
      if (aTrailing === undefined) return -1;
      if (bTrailing === undefined) return 1;
      return aTrailing - bTrailing;
    })
    .map(({ market }) => market);
  const total = positive.reduce((sum, market) => sum + market.amountCents, 0);
  let cursor = 0;
  return positive.map((market) => {
    const start = cursor / total;
    cursor += market.amountCents;
    return { ...market, start, end: cursor / total, fraction: market.amountCents / total };
  });
}

/**
 * A symmetric semicircle straightens vertically into a square-ended strip.
 * Progress below 0 continues the same interpolation into a half-depth smile,
 * mirrored across the strip line, for pull-to-refresh overscroll.
 */
export function allocationPath(
  start: number,
  end: number,
  progress: number,
  width: number,
  diameter: number,
) {
  'worklet';
  const p = Math.max(-0.5, Math.min(1, progress));
  const radius = diameter / 2 - 2;
  const innerRadius = radius - 44;
  // Keep every tick separated throughout the morph, including the flattened strip.
  const gap = Math.min((end - start) * 0.28, 0.0038);
  const points: string[] = [];
  for (let edge = 0; edge < 2; edge++) {
    for (let step = 0; step <= 8; step++) {
      const t =
        edge === 0
          ? start + gap + ((end - start - gap * 2) * step) / 8
          : end - gap - ((end - start - gap * 2) * step) / 8;
      const angle = Math.PI * (1 - t);
      const r = edge === 0 ? radius : innerRadius;
      const arcX = width / 2 + Math.cos(angle) * r;
      const arcY = radius + 4 - Math.sin(angle) * r;
      const x = t * width * (1 - p) + arcX * p;
      const y = (edge === 0 ? 94 : 122) * (1 - p) + arcY * p;
      points.push(`${x.toFixed(4)},${y.toFixed(4)}`);
    }
  }
  return `M${points.join(' L')} Z`;
}

/** Scroll-driven collapse never changes the measured content slot, avoiding scroll feedback. */
export function allocationScrollState(naturalTop: number, pinnedTop: number) {
  'worklet';
  const collapse = Math.max(0, Math.min(1, (pinnedTop - naturalTop) / 120));
  const barTop = Math.max(naturalTop, pinnedTop - 94);
  return { collapse, barTop, circleTop: naturalTop + (barTop - naturalTop) * collapse };
}

/** Hit testing follows the same arc/strip coordinates; the center resets the selection. */
export function allocationHitFraction(
  x: number,
  y: number,
  progress: number,
  width: number,
  diameter: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  const radius = diameter / 2 - 2;
  if (p > 0.8 && Math.hypot(x - width / 2, y - radius - 4) < radius - 52) return null;
  if (p > 0.8) return 1 - Math.atan2(Math.max(0, radius + 4 - y), x - width / 2) / Math.PI;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 16; i++) {
    const t = (lo + hi) / 2;
    const atX = t * width * (1 - p) + (width / 2 + Math.cos(Math.PI * (1 - t)) * (radius - 22)) * p;
    if (atX < x) lo = t;
    else hi = t;
  }
  return (lo + hi) / 2;
}
