import React from 'react';
import { Redirect } from 'expo-router';
import type { LegalPageProps } from './LegalPage.types';

/** Mobile: the document pages are web only for now (frozen app, footer plan F-Q1). Nothing links here on mobile. */
export function LegalPage(_props: LegalPageProps) {
  return <Redirect href="/" />;
}
