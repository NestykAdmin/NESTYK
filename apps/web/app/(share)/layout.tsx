import React from 'react';
import { RootDocument } from '../../lib/root-document';

export const metadata = {
  title: 'NESTYK — ค้นหาคอนโดและห้องเช่าคุณภาพดีที่สุด',
  description: 'แพลตฟอร์มค้นหาห้องเช่า คอนโดใกล้รถไฟฟ้า พร้อมนัดดูห้องและบริการส่วนกลางครบวงจร',
  // Share and signing links are private to the people who received them: never indexed (SEO-0).
  robots: { index: false, follow: false },
};

/** Root layout of the room share (/s/<token>) and signing (/sign/<token>) pages. Thai, outside language routing. */
export default function ShareRootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="th">{children}</RootDocument>;
}
