import React from 'react';
import { Text } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { consentParts, legalHref } from '../../lib/legal-footer';
import type { ConsentLabelProps } from './ConsentLabel.types';

// A click on a link must open the document only, not tick the checkbox the label sits in.
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Web: "I accept the {terms} and the {privacy}" with both words as links that open in a new tab (footer plan F3),
 * so the form being filled in is not lost. The sentence order comes from i18n (`legal.consent`).
 */
export function ConsentLabel({ style, linkColor }: ConsentLabelProps) {
  const { t } = useLocale();
  const parts = consentParts(t.legal.consent, { terms: t.legal.footer.terms, privacy: t.legal.footer.privacy });
  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.kind === 'text' ? (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ) : (
          <a
            key={index}
            href={legalHref(part.page)}
            target="_blank"
            rel="noopener"
            data-testid={`register.consent.${part.page}`}
            onClick={stop}
            onMouseDown={stop}
            onPointerDown={stop}
            onTouchStart={stop}
            onKeyDown={stop}
            style={{ color: linkColor, textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {part.text}
          </a>
        ),
      )}
    </Text>
  );
}
