import React from 'react';
import { Mitr, Baloo_2, Noto_Sans_Thai } from 'next/font/google';

const mitr = Mitr({
  subsets: ['thai', 'latin'],
  weight: ['400', '500'],
  variable: '--font-mitr',
  display: 'swap',
});

const baloo2 = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-baloo2',
  display: 'swap',
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
});

const BASE_CSS = `
  :root {
    --font-mitr: ${mitr.style.fontFamily};
    --font-baloo2: ${baloo2.style.fontFamily};
    --font-noto-sans-thai: ${notoSansThai.style.fontFamily};
  }
  * {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body, button, input, select, textarea {
    font-family: var(--font-noto-sans-thai), "Noto Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 400;
    line-height: 1.5;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-mitr), "Mitr", sans-serif;
    font-weight: 500;
    line-height: 1.45;
  }
`;

/**
 * The <html> document shared by the app's two root layouts: the guest pages under
 * app/[locale] (lang follows the URL) and the share/sign pages under app/(share) (Thai).
 */
export function RootDocument({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className={`${mitr.variable} ${baloo2.variable} ${notoSansThai.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8FAFC' }}>{children}</body>
    </html>
  );
}
