import React from 'react';
import type { WebContentContainerProps } from './WebContentContainer.types';
import './web-content-container.css';

export type { WebContentContainerProps } from './WebContentContainer.types';

/** Shared page-body boundary. App navigation and full-screen overlays stay outside. */
export function WebContentContainer({ children, fill = false }: WebContentContainerProps) {
  return (
    <div data-web-content-container="" className={`nestyk-web-container${fill ? ' nestyk-web-container-fill' : ''}`}>
      <div className="nestyk-web-content">{children}</div>
    </div>
  );
}

/**
 * Root fallback for every route, including future pages without a workspace shell.
 * When a shell supplies WebContentContainer, CSS delegates to that inner boundary
 * so navigation stays full width and gutters are never applied twice.
 */
export function WebContentRoot({ children }: Pick<WebContentContainerProps, 'children'>) {
  return (
    <div data-web-content-root="" className="nestyk-web-container nestyk-web-container-fill">
      <div className="nestyk-web-content">{children}</div>
    </div>
  );
}
