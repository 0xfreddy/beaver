'use dom';

import createGlobe from 'cobe';
import { useEffect, useRef, useState } from 'react';
import type { DOMProps } from 'expo/dom';
import './bank-globe.css';

const places = [
  { id: 'new-york', name: 'New York', country: 'United States', location: [40.71, -74.01] },
  { id: 'vancouver', name: 'Vancouver', country: 'Canada', location: [49.28, -123.12] },
  { id: 'london', name: 'London', country: 'United Kingdom', location: [51.51, -0.13] },
  { id: 'singapore', name: 'Singapore', country: 'Asia-Pacific', location: [1.35, 103.82] },
  { id: 'sydney', name: 'Sydney', country: 'Australia', location: [-33.87, 151.21] },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', location: [-33.92, 18.42] },
] satisfies { id: string; name: string; country: string; location: [number, number] }[];

export default function BankGlobeDOM({
  active,
  reduceMotion,
  fontScale,
  accent,
  accentInk,
}: {
  active: boolean;
  reduceMotion: boolean;
  fontScale: number;
  accent: string;
  accentInk: string;
  dom?: DOMProps;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const animation = useRef({ active, reduceMotion, expanded });
  const redraw = useRef<(() => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    animation.current = { active, reduceMotion, expanded };
    redraw.current?.();
  }, [active, reduceMotion, expanded, fontScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let phi = 0.4;
    let pointer: { id: number; x: number } | null = null;
    let velocity = 0;
    let lastMove = 0;
    let lastFrame = 0;
    let frame = 0;
    let globe: ReturnType<typeof createGlobe>;
    try {
      globe = createGlobe(canvas, {
        width: stage.clientWidth * dpr,
        height: stage.clientWidth * dpr,
        devicePixelRatio: dpr,
        phi,
        theta: 0.22,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [1, 1, 1],
        markerColor: [0.45, 0.45, 0.45],
        glowColor: [1, 1, 1],
        scale: 0.92,
        markers: places.map((place) => ({ id: place.id, location: place.location, size: 0.035 })),
      });
    } catch {
      setUnavailable(true);
      return;
    }

    // COBE's own projected anchors also work in WebViews without CSS anchor positioning.
    const labels = places.map((place) => ({
      id: place.id,
      label: stage.querySelector<HTMLButtonElement>(`[data-place="${place.id}"]`),
      anchor: stage.querySelector<HTMLElement>(`[style*="anchor-name: --cobe-${place.id}"]`),
    }));
    const draw = () => {
      globe.update({ phi });
      const visibility = getComputedStyle(document.documentElement);
      const occupied: { x: number; y: number; width: number; height: number }[] = [];
      const ordered = [...labels].sort(
        (a, b) =>
          Number(b.id === animation.current.expanded) - Number(a.id === animation.current.expanded),
      );
      for (const item of ordered) {
        if (!item.anchor)
          item.anchor = stage.querySelector<HTMLElement>(
            `[style*="anchor-name: --cobe-${item.id}"]`,
          );
        if (!item.label || !item.anchor) continue;
        let visible = visibility.getPropertyValue(`--cobe-visible-${item.id}`).trim() !== '';
        const width = item.label.offsetWidth;
        const height = item.label.offsetHeight;
        const x = Math.max(
          width / 2 + 24,
          Math.min(
            stage.clientWidth - width / 2,
            (parseFloat(item.anchor.style.left) * stage.clientWidth) / 100,
          ),
        );
        const y = Math.max(
          height + 6,
          (parseFloat(item.anchor.style.top) * stage.clientWidth) / 100,
        );
        const rect = { x: x - width / 2, y: y - height - 6, width, height };
        if (
          occupied.some(
            (other) =>
              rect.x < other.x + other.width + 4 &&
              rect.x + width + 4 > other.x &&
              rect.y < other.y + other.height + 4 &&
              rect.y + height + 4 > other.y,
          )
        )
          visible = false;
        if (visible) occupied.push(rect);
        item.label.style.left = `${x}px`;
        item.label.style.top = `${y}px`;
        item.label.style.visibility = visible ? 'visible' : 'hidden';
      }
    };
    redraw.current = draw;
    const resize = new ResizeObserver(() => {
      globe.update({ width: stage.clientWidth * dpr, height: stage.clientWidth * dpr });
      draw();
    });
    resize.observe(stage);
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 16.667 || 1, 3);
      lastFrame = now;
      if (
        animation.current.active &&
        !document.hidden &&
        !pointer &&
        !animation.current.reduceMotion
      ) {
        // Release momentum settles back into a gentle idle rotation.
        phi += (0.0015 + velocity) * dt;
        velocity *= Math.pow(0.92, dt);
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const down = (event: PointerEvent) => {
      if (pointer) return;
      pointer = { id: event.pointerId, x: event.clientX };
      velocity = 0;
      lastMove = performance.now();
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const now = performance.now();
      const delta = (event.clientX - pointer.x) / 180;
      phi += delta;
      velocity = (delta * 16.667) / Math.max(now - lastMove, 8);
      pointer.x = event.clientX;
      lastMove = now;
      draw();
    };
    const up = (event: PointerEvent) => {
      if (pointer?.id !== event.pointerId) return;
      pointer = null;
      if (performance.now() - lastMove > 80 || event.type === 'pointercancel') velocity = 0;
      canvas.style.cursor = 'grab';
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      velocity = 0;
      phi += event.key === 'ArrowLeft' ? -0.2 : 0.2;
      draw();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('keydown', key);
    draw();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      redraw.current = null;
      resize.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('keydown', key);
      globe.destroy();
    };
  }, []);

  return (
    <div className="bank-globe" style={{ fontSize: 12 * Math.min(fontScale, 1.5) }}>
      <div className="bank-globe-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Interactive world globe. Drag horizontally or use left and right arrow keys to rotate."
        />
        {!unavailable &&
          places.map((place) => (
            <button
              key={place.id}
              type="button"
              className="bank-globe-label"
              data-place={place.id}
              aria-expanded={expanded === place.id}
              style={
                expanded === place.id
                  ? { backgroundColor: accent, borderColor: accent, color: accentInk }
                  : undefined
              }
              onClick={() => setExpanded(expanded === place.id ? null : place.id)}
            >
              <span>{place.name}</span>
              {expanded === place.id && <span className="bank-globe-detail">{place.country}</span>}
            </button>
          ))}
        {unavailable && <p className="bank-globe-fallback">Choose your bank’s region above.</p>}
      </div>
    </div>
  );
}
