import React, { forwardRef } from 'react';
import type { GuestWebViewHandle, GuestWebViewProps } from './GuestWebView.types';

/** On the web the guest pages are the Next.js site itself; nothing to embed (W1). */
export const GuestWebView = forwardRef<GuestWebViewHandle, GuestWebViewProps>(function GuestWebView(_props, _ref) {
  return null;
});
