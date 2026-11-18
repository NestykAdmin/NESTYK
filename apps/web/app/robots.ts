import type { MetadataRoute } from 'next';
import { guestSiteIndexable, guestSiteOrigin, robotsRules } from '../lib/guest-seo';

/** /robots.txt (SEO-0). Whether pages are indexed is decided by each page's robots tag, not here. */
export default function robots(): MetadataRoute.Robots {
  return robotsRules(guestSiteOrigin(), guestSiteIndexable());
}
