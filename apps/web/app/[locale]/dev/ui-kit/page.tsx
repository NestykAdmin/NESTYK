import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { UiKitLanguageCheck } from './UiKitLanguageCheck';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return guestPageMetadata({ locale, path: '/dev/ui-kit', title: 'UI kit · NESTYK', index: false });
}

/** Developer page for checking guest pieces (S2.7). Not available in production. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense>
      <UiKitLanguageCheck />
    </Suspense>
  );
}
