import React from 'react';
import { Text } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { consentParts, legalHref } from '../../lib/legal-footer';
import type { ConsentLabelProps } from './ConsentLabel.types';

// A click on a link must open the document only, not tick the checkbox the label sits in.
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Web: "I accept the {terms}" (checkbox) or "Read how we … in our {privacy}" (notice line), with the document word as a
 * link that opens in a new tab (footer plan F3), so the form being filled in is not lost. Sentences come from i18n
 * (`legal.consent`, `legal.privacyNotice`).
 */
export function ConsentLabel({ style, linkColor, template = 'consent' }: ConsentLabelProps) {
  const { t } = useLocale();
  // FE5: the checkbox accepts the terms only; the privacy policy is a notice line with its own link.
  const sentence = template === 'privacyNotice' ? t.legal.privacyNotice : t.legal.consent;
  const testPrefix = template === 'privacyNotice' ? 'register.privacyNotice' : 'register.consent';
  const parts = consentParts(sentence, { terms: t.legal.footer.terms, privacy: t.legal.footer.privacy });
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
            data-testid={`${testPrefix}.${part.page}`}
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
