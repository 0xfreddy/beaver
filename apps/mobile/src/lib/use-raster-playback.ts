import { useEffect, useRef, useState } from 'react';

export function useRasterPlayback({
  frameCount,
  duration,
  loop,
  reduced,
  progress,
  onAnimationFinish,
}: {
  frameCount: number;
  duration: number;
  loop: boolean;
  reduced: boolean;
  progress?: number;
  onAnimationFinish?: () => void;
}) {
  const [frame, setFrame] = useState(reduced ? Math.floor(frameCount / 2) : 0);
  const finish = useRef(onAnimationFinish);
  useEffect(() => {
    finish.current = onAnimationFinish;
  }, [onAnimationFinish]);
  useEffect(() => {
    if (progress !== undefined || reduced) {
      setFrame(Math.floor(frameCount / 2));
      return;
    }
    const startedAt = Date.now();
    setFrame(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const position = loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
      setFrame(Math.min(frameCount - 1, Math.floor(position * frameCount)));
      if (!loop && elapsed >= duration) {
        clearInterval(timer);
        finish.current?.();
      }
    }, duration / frameCount);
    return () => clearInterval(timer);
  }, [duration, frameCount, loop, progress, reduced]);
  return progress === undefined
    ? frame
    : Math.round(Math.max(0, Math.min(1, progress)) * (frameCount - 1));
}
