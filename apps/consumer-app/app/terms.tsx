// Footer plan (Mos 4 Nov 2026): public document page, no login (route kind 'legal' in lib/app-routes.ts).
// Web: draft outline page. Mobile: sends you home (web only for now).
import React from 'react';
import { LegalPage } from '../components/legal/LegalPage';

export default function TermsRoute() {
  return <LegalPage page="terms" />;
}
