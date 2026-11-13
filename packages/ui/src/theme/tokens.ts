/**
 * NESTYK Design Tokens
 */
export const tokens = {
  colors: {
    // 🟡 Corporate Identity Core
    primary: '#211e1e',
    brand: {
      50: '#fff9e8',
      100: '#fff0c4',
      /** Hairline border in the brand family (colour system v1.1). */
      200: '#fcde96',
      500: '#f8b615',
      600: '#f8b615',
      700: '#d99a0d',
    },
    /** Selection mark (outline check) — deeper amber than chip/CTA yellow. */
    selectionMark: '#ca8a04',
    white: '#ffffff',
    onBrand: '#211e1e',

    // 🏢 Surfaces & Text
    background: '#f8fafc',
    border: '#e5e7eb',
    divider: '#cbd5e1',
    placeholder: '#94a3b8',
    textHeading: '#334155',
    textSecondary: '#64748b',
    slate: {
      50: '#f8fafc',
      200: '#e5e7eb',
      600: '#64748b',
      700: '#334155',
      900: '#211e1e',
    },

    // 🚦 Semantic & Status Colors
    danger: '#dc2626',
    error: '#dc2626',
    warning: '#f59e0b',
    success: '#22c55e',
    accent: '#2563eb',
    info: '#2563eb',

    /** Soft status surfaces (pills / icon wells) — prefer over flooding role colors */
    subtle: {
      // Colour system v1.1 (CI, 12 Nov 2026): bg 50 · text 800 of the CI family.
      successBg: '#f0fdf4',
      successFg: '#166534',
      warningBg: '#fffbeb',
      warningFg: '#92400e',
      dangerBg: '#fef2f2',
      dangerFg: '#991b1b',
      infoBg: '#eff6ff',
      infoFg: '#1e3a8a',
      brandBg: '#fff9e8',
      neutralBg: '#f1f5f9',
      track: '#e2e8f0',
    },

    // 🧭 Icon Colors (Allowed Palette)
    icon: {
      dark: '#211e1e',
      secondary: '#64748b',
      brand: '#f8b615',
      muted: '#cbd5e1',
      white: '#ffffff',
    },

    // 🎭 Multi-App Roles & Services
    roles: {
      // Colour system v1.1 (CI, 12 Nov 2026): deep 800 tones of the CI families; agent is brand ink + yellow.
      guest: '#f8b615',      // brand yellow
      tenant: '#166534',     // success 800
      landlord: '#1e3a8a',   // info 800
      agent: '#211e1e',      // brand ink (paired with yellow)
      self_owner: '#92400e', // warning 800 ("Owner")
      admin: '#334155',      // slate 700
      services: '#475569',   // slate 600
    },

    // 🌙 Role colours for text, icons and spinners in dark mode (v1.1). The deep role tones read under
    // 2.4:1 on the dark background, so dark mode uses these light steps (≥ 6.5:1 on #211e1e and #2f2b2b).
    // Solid role fills (hero card, solid badge) keep `roles` with white text.
    rolesOnDark: {
      guest: '#f8b615',      // brand yellow
      tenant: '#4ade80',     // success 400
      landlord: '#93c5fd',   // info 300
      agent: '#f8b615',      // brand yellow (ink + yellow pair)
      self_owner: '#fdba74', // warning 300
      admin: '#cbd5e1',      // slate 300
      services: '#94a3b8',   // slate 400
    },

    // 🌗 v1.2 (12 Nov 2026, dark = B+C): lifted grey for selected / leading elements in dark mode
    // (selected menu item, workspace box, own avatar). Same value as the web's --aw-lift.
    lift: '#4A4545',
    /** Dark mode hover on lifted elements (selected menu item, workspace box). Same value as the web's --aw-lift-hover. */
    liftHover: '#575151',

    // 🌙 Text on dark surfaces (v1.2 B+C, Mos 12 Nov 2026): primary / body / muted. Each reads >= 4.5:1 on the dark
    // page (#211E1E) and on cards (#2F2B2B). Same values as the web's --aw-text-1 / --aw-text-2 / --aw-text-3.
    textOnDark: {
      primary: '#FFFFFF',
      secondary: '#E2E8F0',
      muted: '#A8B4C6',
    },

    // 👤 Initials avatar of other people (leads, tenants): one neutral tone for everyone, never the status,
    // role or brand colour (Mos, 12 Nov 2026, design B4). Yellow stays for the signed-in user's own avatar.
    avatar: {
      light: { bg: '#E2E8F0', fg: '#334155' }, // v1.2: CI neutral text (#1E293B was off-CI, Mos 12 Nov 16:13)
      dark: { bg: '#4A4545', fg: '#E7E5E4' },
    },
  },

  typography: {
    // ฟอนต์ Web (ใช้ CSS Variables จาก next/font/google พร้อม Fallback)
    web: {
      headingTh: 'var(--font-mitr), "Mitr", sans-serif',
      headingEn: 'var(--font-baloo2), "Baloo 2", cursive, sans-serif',
      body: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
    },
    // ฟอนต์ Native (ใช้ชื่อฟอนต์ที่โหลดผ่าน @expo-google-fonts/*)
    native: {
      headingTh: 'Mitr_500Medium',
      headingEn: 'Baloo2_400Regular',
      body: 'NotoSansThai_400Regular',
      bodyBold: 'NotoSansThai_700Bold',
    },
    // ค่ามาตรฐานสำหรับ Web
    fonts: {
      headingTh: 'var(--font-mitr), "Mitr", sans-serif',
      headingEn: 'var(--font-baloo2), "Baloo 2", cursive, sans-serif',
      body: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
      bodyBold: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
    },
    lineHeightRatio: 1.5, // บังคับสัดส่วน 1.45–1.5x สำหรับภาษาไทยป้องกันสระตกขอบ
  },
} as const;

type RoleKey = keyof typeof tokens.colors.roles;

/** A role colour for text, icons or spinners: the light dark-mode step when `isDark`, other colours unchanged. */
export function roleOnDark(color: string, isDark: boolean): string {
  if (!isDark) return color;
  const hex = color.toLowerCase();
  const role = (Object.keys(tokens.colors.roles) as RoleKey[]).find((key) => tokens.colors.roles[key] === hex);
  return role ? tokens.colors.rolesOnDark[role] : color;
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'link';
