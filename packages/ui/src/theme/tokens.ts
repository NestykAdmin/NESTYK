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
      successBg: '#dcfce7',
      successFg: '#15803d',
      warningBg: '#ffedd5',
      warningFg: '#c2410c',
      dangerBg: '#fee2e2',
      dangerFg: '#dc2626',
      infoBg: '#dbeafe',
      infoFg: '#1d4ed8',
      brandBg: '#fef3c7',
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
      guest: '#f8b615',     // 🟡 Warm Yellow (Marketplace)
      tenant: '#00c68d',    // 🟢 Neo Mint (Tenant)
      landlord: '#0055da',  // 🔵 Electric Blue (Landlord)
      agent: '#ff0052',     // 🔴 Neon Rose (Agent)
      admin: '#0f172a',     // ⚫ Deep Slate (Admin / Operations)
      services: '#0284c7',  // 🔷 Sky Blue (Services Hub)
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

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'link';
