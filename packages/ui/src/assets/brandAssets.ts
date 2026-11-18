/// <reference path="./png.d.ts" />

/**
 * Shared NESTYK brand image sources (Metro / Next transpilePackages).
 * Canonical files: packages/ui/assets/nestyk/
 * Usage guide: docs/NESTYK/brand-assets.md
 */

// —— Icon (mark) ——
import brandIcon from '../../assets/nestyk/png/icon-nestyk-standard.png';
import brandIconWhite from '../../assets/nestyk/png/icon-nestyk-white.png';
import brandIconBlack from '../../assets/nestyk/png/icon-nestyk-black.png';
import brandIconSecondary from '../../assets/nestyk/png/icon-nestyk-secondary.png';

// —— Logo (wordmark) ——
import brandLogo from '../../assets/nestyk/png/logo-nestyk-standard.png';
import brandLogoWhite from '../../assets/nestyk/png/logo-nestyk-white.png';
import brandLogoBlack from '../../assets/nestyk/png/logo-nestyk-black.png';
import brandLogoGrey from '../../assets/nestyk/png/logo-nestyk-grey.png';
import brandLogoGreyReverse from '../../assets/nestyk/png/logo-nestyk-grey-reverse.png';
import brandLogoOnYellow from '../../assets/nestyk/png/logo-nestyk-onYellow.png';
import brandLogoOnBlack from '../../assets/nestyk/png/logo-nestyk-onBlack.png';

export {
  brandIcon,
  brandIconWhite,
  brandIconBlack,
  brandIconSecondary,
  brandLogo,
  brandLogoWhite,
  brandLogoBlack,
  brandLogoGrey,
  brandLogoGreyReverse,
  brandLogoOnYellow,
  brandLogoOnBlack,
};

/** Component variants — see docs/NESTYK/brand-assets.md §3 */
export type NestykLogoVariant =
  | 'mark'
  | 'markOnDark'
  | 'markOnBrand'
  | 'markSecondary'
  | 'wordmark'
  | 'wordmarkOnDark'
  | 'wordmarkOnYellow'
  | 'wordmarkOnBlack';

/** Wordmark aspect from SVG viewBox 618×219 (CI, 12 Nov 2026) */
export const NESTYK_WORDMARK_ASPECT = 618 / 219;

/** Mark aspect (square) */
export const NESTYK_MARK_ASPECT = 1;
