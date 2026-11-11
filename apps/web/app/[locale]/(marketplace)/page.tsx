import React from 'react';
import type { Metadata } from 'next';
import { guestPageMetadata } from '../../../lib/guest-seo';
import HomeMock from './HomeMock';

type Props = { params: Promise<{ locale: string }> };

/** Title and description come from the layout ([locale]/layout.tsx). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return guestPageMetadata({ locale, path: '/' });
}

/** Guest home. The body is still the old sample page; S3 replaces it with design v2.3. */
export default function HomePage() {
  return <HomeMock />;
}
