import type { MetadataRoute } from 'next';
import { guestSiteIndexable, guestSiteOrigin, INDEXABLE_PATHS, sitemapEntries } from '../lib/guest-seo';

/** /sitemap.xml (SEO-0): every language of each indexable page. Empty on a deploy that is not indexable. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(guestSiteOrigin(), guestSiteIndexable(), INDEXABLE_PATHS);
}
