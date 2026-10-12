import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRasterPlayback } from './use-raster-playback';

let renderer: ReactTestRenderer;
let frame = 0;
function Playback(props: Parameters<typeof useRasterPlayback>[0]) {
  frame = useRasterPlayback(props);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('does not restart a one-shot animation when its completion callback changes', async () => {
  const oldFinish = vi.fn(),
    newFinish = vi.fn();
  const props = { frameCount: 10, duration: 1000, loop: false, reduced: false };
  await act(async () => {
    renderer = create(createElement(Playback, { ...props, onAnimationFinish: oldFinish }));
  });
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(frame).toBe(5);
  await act(async () =>
    renderer.update(createElement(Playback, { ...props, onAnimationFinish: newFinish })),
  );
  expect(frame).toBe(5);
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
  expect(frame).toBe(9);
  expect(newFinish).toHaveBeenCalledTimes(1);
  expect(oldFinish).not.toHaveBeenCalled();
});
