'use client';

import React from 'react';
import {
  MagnifyingGlass,
  House,
  Key,
  SquaresFour,
  List,
  Bell,
  Moon,
  CaretLeft,
  CaretRight,
  CaretDown,
  X,
  Heart,
  DotsThreeVertical,
  Trash,
  Calendar,
  Sparkle,
  Wrench,
  ClipboardText,
  ChatCircle,
  Ticket,
  BellRinging,
  Package,
  Handshake,
  Shield,
  User,
  Users,
  UserPlus,
  CreditCard,
  Gear,
  Globe,
  Check,
  CalendarPlus,
  QrCode,
  Buildings,
  Bed,
  Bathtub,
  StackSimple,
  FrameCorners,
  Camera,
  Coins,
  MapPin,
  NotePencil,
  WarningCircle,
  Envelope,
  Phone,
  GoogleLogo,
  FacebookLogo,
  AppleLogo,
  ArrowsLeftRight,
  Funnel,
  SlidersHorizontal,
  Lock,
  Plus,
  PencilSimple,
  Info,
  FileText,
  Armchair,
  Snowflake,
  Television,
  CookingPot,
  Drop,
  Car,
  Bicycle,
  Waves,
  Barbell,
  Tree,
  PawPrint,
  WifiHigh,
  Archive,
  Plug,
  Lightning,
  Bus,
  Train,
  GraduationCap,
  FirstAid,
  Flame,
  CoatHanger,
  Door,
  Cube,
  Shower,
  ForkKnife,
  Wine,
  Toilet,
  Thermometer,
  Wind,
  Wallet,
  Files,
  IconProps,
} from 'phosphor-react';
import { tokens } from '../theme/tokens';
import { AppIconName, AppIconTone } from './types';

const ICON_MAP: Record<Exclude<AppIconName, 'house-plus'>, React.ComponentType<IconProps>> = {
  search: MagnifyingGlass,
  home: House,
  key: Key,
  grid: SquaresFour,
  'list-rows': List,
  menu: List,
  bell: Bell,
  moon: Moon,
  'chevron-left': CaretLeft,
  'chevron-right': CaretRight,
  'chevron-down': CaretDown,
  close: X,
  heart: Heart,
  'dots-vertical': DotsThreeVertical,
  trash: Trash,
  calendar: Calendar,
  sparkle: Sparkle,
  wrench: Wrench,
  clipboard: ClipboardText,
  chat: ChatCircle,
  ticket: Ticket,
  siren: BellRinging,
  package: Package,
  handshake: Handshake,
  shield: Shield,
  user: User,
  users: Users,
  'user-plus': UserPlus,
  'credit-card': CreditCard,
  gear: Gear,
  globe: Globe,
  check: Check,
  'calendar-plus': CalendarPlus,
  'qr-code': QrCode,
  buildings: Buildings,
  bed: Bed,
  bath: Bathtub,
  stairs: StackSimple,
  'room-size': FrameCorners,
  camera: Camera,
  coins: Coins,
  'map-pin': MapPin,
  note: NotePencil,
  warning: WarningCircle,
  envelope: Envelope,
  phone: Phone,
  google: GoogleLogo,
  facebook: FacebookLogo,
  apple: AppleLogo,
  swap: ArrowsLeftRight,
  funnel: Funnel,
  sliders: SlidersHorizontal,
  lock: Lock,
  plus: Plus,
  pencil: PencilSimple,
  info: Info,
  'file-text': FileText,
  // Amenity icons — phosphor-react 1.x fallbacks where native-only icons missing
  couch: Armchair,
  armchair: Armchair,
  snowflake: Snowflake,
  fan: Wind,
  television: Television,
  desk: FrameCorners,
  chair: Armchair,
  'cooking-pot': CookingPot,
  oven: CookingPot,
  'washing-machine': Drop,
  drop: Drop,
  car: Car,
  motorcycle: Bicycle,
  bicycle: Bicycle,
  waves: Waves,
  barbell: Barbell,
  tree: Tree,
  paw: PawPrint,
  wifi: WifiHigh,
  'fire-extinguisher': Flame,
  broom: Wrench,
  archive: Archive,
  plug: Plug,
  lightning: Lightning,
  bus: Bus,
  train: Train,
  park: Tree,
  'graduation-cap': GraduationCap,
  hospital: FirstAid,
  flame: Flame,
  'coat-hanger': CoatHanger,
  door: Door,
  'swimming-pool': Waves,
  plant: Tree,
  cube: Cube,
  garage: Buildings,
  'charging-station': Lightning,
  shower: Shower,
  'fork-knife': ForkKnife,
  wine: Wine,
  toilet: Toilet,
  thermometer: Thermometer,
  wind: Wind,
  elevator: StackSimple,
  wallet: Wallet,
  files: Files,
};

const TONE_COLORS: Record<AppIconTone, string> = {
  active: tokens.colors.icon.dark,
  inactive: tokens.colors.icon.secondary,
  brand: tokens.colors.icon.brand,
  white: tokens.colors.icon.white,
  muted: tokens.colors.icon.muted,
  danger: tokens.colors.danger,
  accent: tokens.colors.accent,
  success: tokens.colors.success,
  warning: tokens.colors.warning,
};

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  tone?: AppIconTone;
  color?: string;
  weight?: IconProps['weight'];
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 22,
  tone = 'inactive',
  color,
  weight = 'regular',
  className,
}) => {
  if (name === 'house-plus') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 20H3V10L12 2L20 9M19 13V21M15 17H23"
          stroke={color ?? TONE_COLORS[tone]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      color={color ?? TONE_COLORS[tone]}
      weight={weight}
      className={className}
      aria-hidden
    />
  );
};
