import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import type { KeyboardFrame } from './auth-layout-rules';

const CLOSED: KeyboardFrame = { open: false, height: 0, top: 0 };

/**
 * App: whether the keyboard is up. The screen itself makes room for it (KeyboardAvoidingView), so only `open` is
 * used. iOS tells us before it moves (keyboardWillShow); Android only after (keyboardDidShow).
 */
export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(CLOSED);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(show, () => setFrame({ open: true, height: 0, top: 0 }));
    const onHide = Keyboard.addListener(hide, () => setFrame(CLOSED));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return frame;
}
