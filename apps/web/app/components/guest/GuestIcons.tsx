import React from 'react';
import type { SocialId } from '../../../lib/guest-site';

/** Line icons of design v2.3. Colour comes from the text colour (currentColor) set in guest.css. */
type IconProps = { size?: number; className?: string };

function Line({ size = 20, className, strokeWidth = 1.8, children }: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const GlobeIcon = (props: IconProps) => (
  <Line {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
  </Line>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Line strokeWidth={2} {...props}>
    <path d="m6 9 6 6 6-6" />
  </Line>
);

export const ChevronUpIcon = (props: IconProps) => (
  <Line strokeWidth={2} {...props}>
    <path d="m6 15 6-6 6 6" />
  </Line>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Line strokeWidth={2} {...props}>
    <path d="m9 18 6-6-6-6" />
  </Line>
);

export const CheckIcon = (props: IconProps) => (
  <Line strokeWidth={2.2} {...props}>
    <path d="m5 12 5 5 9-10" />
  </Line>
);

export const HeartIcon = (props: IconProps) => (
  <Line {...props}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Line>
);

export const HomeIcon = (props: IconProps) => (
  <Line strokeWidth={1.9} {...props}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h14V10" />
  </Line>
);

export const SearchIcon = (props: IconProps) => (
  <Line strokeWidth={1.9} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Line>
);

export const UserIcon = (props: IconProps) => (
  <Line {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </Line>
);

export const CalendarIcon = (props: IconProps) => (
  <Line {...props}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Line>
);

export const SunIcon = (props: IconProps) => (
  <Line {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </Line>
);

export const HelpIcon = (props: IconProps) => (
  <Line {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
  </Line>
);

export const InfoIcon = (props: IconProps) => (
  <Line {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </Line>
);

export const ShieldIcon = (props: IconProps) => (
  <Line {...props}>
    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
  </Line>
);

export const DocumentIcon = (props: IconProps) => (
  <Line {...props}>
    <path d="M7 3h8l4 4v14H7z" />
    <path d="M15 3v4h4M10 12h6M10 16h6" />
  </Line>
);

export const SlidersIcon = (props: IconProps) => (
  <Line {...props}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Line>
);

export const PhoneIcon = (props: IconProps) => (
  <Line {...props}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Line>
);

export const MailIcon = (props: IconProps) => (
  <Line {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Line>
);

/** Brand marks of the social channels. The cut-out parts take the background colour (.nk-social__cut). */
export function SocialIcon({ id }: { id: SocialId }) {
  switch (id) {
    case 'facebook':
      return (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
          <rect x="0.5" y="4" width="23" height="16" rx="4.5" fill="currentColor" />
          <path className="nk-social__cut" d="M9.6 8.4 15.8 12l-6.2 3.6z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg aria-hidden="true" width="20" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.3 6.3 0 1 0 5.4 6.2V8.6a7.8 7.8 0 0 0 4.4 1.4V6.6a4.4 4.4 0 0 1-4.4-4.6z" />
        </svg>
      );
    case 'line':
      return (
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
          <rect x="1" y="3" width="22" height="18" rx="6" fill="currentColor" />
          <text className="nk-social__cut" x="12" y="14.6" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="6.4" fontWeight="700">
            LINE
          </text>
        </svg>
      );
    case 'linkedin':
      return (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
          <rect x="1" y="1" width="22" height="22" rx="4" fill="currentColor" />
          <path
            className="nk-social__cut"
            d="M6 9.5h2.6V18H6zM7.3 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM10.3 9.5h2.5v1.2c.4-.7 1.3-1.4 2.6-1.4 2.7 0 3.2 1.8 3.2 4.1V18H16v-4c0-1 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V18h-2.7z"
          />
        </svg>
      );
  }
}
