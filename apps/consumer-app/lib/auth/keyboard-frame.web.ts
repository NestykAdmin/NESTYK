import { useEffect, useState } from 'react';
import { keyboardFrame, type KeyboardFrame } from './auth-layout-rules';

function read(): KeyboardFrame {
  if (typeof window === 'undefined' || !window.visualViewport) return { open: false, height: 0, top: 0 };
  const viewport = window.visualViewport;
  return keyboardFrame(window.innerHeight, viewport.height, viewport.offsetTop, viewport.scale);
}

/**
 * Web: phone browsers put the keyboard over the page and shrink only the visual viewport. The sign-in page then
 * sizes itself to that visible part, so its action bar sits right above the keyboard.
 */
export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(read);
  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = read();
      setFrame((current) =>
        current.open === next.open && current.height === next.height && current.top === next.top ? current : next,
      );
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return frame;
}
