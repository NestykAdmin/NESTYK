import { useEffect, useRef } from 'react';
import { stepSlideDirection, type TabSlideDirection } from '../../lib/tab-transition';

/**
 * Which side a step slides in from, against the step shown before (Jom 25 Nov 2026). Pair with
 * `<TabTransition key={step} direction={...}>`: the key mounts the new step, which keeps the side it got.
 */
export function useStepSlide(step: number): TabSlideDirection | null {
  const shown = useRef<number | null>(null);
  const direction = stepSlideDirection(shown.current, step);
  useEffect(() => {
    shown.current = step;
  }, [step]);
  return direction;
}
