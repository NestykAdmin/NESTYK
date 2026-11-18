/// <reference path="./phosphor-svg.d.ts" />
import React from 'react';
import Svg, { Path } from 'react-native-svg';
// F7: one file per icon (packages/ui uses phosphor-react-native 2.x: default exports). Metro does not
// tree-shake, and the package root pulls in every icon on web.
import MagnifyingGlass from 'phosphor-react-native/src/icons/MagnifyingGlass';
import House from 'phosphor-react-native/src/icons/House';
import Key from 'phosphor-react-native/src/icons/Key';
import SquaresFour from 'phosphor-react-native/src/icons/SquaresFour';
import List from 'phosphor-react-native/src/icons/List';
import Bell from 'phosphor-react-native/src/icons/Bell';
import Moon from 'phosphor-react-native/src/icons/Moon';
import CaretLeft from 'phosphor-react-native/src/icons/CaretLeft';
import CaretRight from 'phosphor-react-native/src/icons/CaretRight';
import CaretDown from 'phosphor-react-native/src/icons/CaretDown';
import X from 'phosphor-react-native/src/icons/X';
import Heart from 'phosphor-react-native/src/icons/Heart';
import DotsThreeVertical from 'phosphor-react-native/src/icons/DotsThreeVertical';
import Trash from 'phosphor-react-native/src/icons/Trash';
import Calendar from 'phosphor-react-native/src/icons/Calendar';
import Sparkle from 'phosphor-react-native/src/icons/Sparkle';
import Wrench from 'phosphor-react-native/src/icons/Wrench';
import ClipboardText from 'phosphor-react-native/src/icons/ClipboardText';
import ChatCircle from 'phosphor-react-native/src/icons/ChatCircle';
import Ticket from 'phosphor-react-native/src/icons/Ticket';
import Siren from 'phosphor-react-native/src/icons/Siren';
import Package from 'phosphor-react-native/src/icons/Package';
import Handshake from 'phosphor-react-native/src/icons/Handshake';
import Shield from 'phosphor-react-native/src/icons/Shield';
import User from 'phosphor-react-native/src/icons/User';
import Users from 'phosphor-react-native/src/icons/Users';
import UserPlus from 'phosphor-react-native/src/icons/UserPlus';
import CreditCard from 'phosphor-react-native/src/icons/CreditCard';
import Gear from 'phosphor-react-native/src/icons/Gear';
import Globe from 'phosphor-react-native/src/icons/Globe';
import Check from 'phosphor-react-native/src/icons/Check';
import CalendarPlus from 'phosphor-react-native/src/icons/CalendarPlus';
import QrCode from 'phosphor-react-native/src/icons/QrCode';
import Buildings from 'phosphor-react-native/src/icons/Buildings';
import Bed from 'phosphor-react-native/src/icons/Bed';
import Bathtub from 'phosphor-react-native/src/icons/Bathtub';
import Stairs from 'phosphor-react-native/src/icons/Stairs';
import FrameCorners from 'phosphor-react-native/src/icons/FrameCorners';
import Camera from 'phosphor-react-native/src/icons/Camera';
import Coins from 'phosphor-react-native/src/icons/Coins';
import MapPin from 'phosphor-react-native/src/icons/MapPin';
import NotePencil from 'phosphor-react-native/src/icons/NotePencil';
import WarningCircle from 'phosphor-react-native/src/icons/WarningCircle';
import Envelope from 'phosphor-react-native/src/icons/Envelope';
import Phone from 'phosphor-react-native/src/icons/Phone';
import GoogleLogo from 'phosphor-react-native/src/icons/GoogleLogo';
import FacebookLogo from 'phosphor-react-native/src/icons/FacebookLogo';
import AppleLogo from 'phosphor-react-native/src/icons/AppleLogo';
import ArrowsLeftRight from 'phosphor-react-native/src/icons/ArrowsLeftRight';
import Funnel from 'phosphor-react-native/src/icons/Funnel';
import SlidersHorizontal from 'phosphor-react-native/src/icons/SlidersHorizontal';
import LockSimple from 'phosphor-react-native/src/icons/LockSimple';
import Plus from 'phosphor-react-native/src/icons/Plus';
import PencilSimple from 'phosphor-react-native/src/icons/PencilSimple';
import Info from 'phosphor-react-native/src/icons/Info';
import FileText from 'phosphor-react-native/src/icons/FileText';
import Couch from 'phosphor-react-native/src/icons/Couch';
import Armchair from 'phosphor-react-native/src/icons/Armchair';
import Snowflake from 'phosphor-react-native/src/icons/Snowflake';
import Fan from 'phosphor-react-native/src/icons/Fan';
import Television from 'phosphor-react-native/src/icons/Television';
import Desk from 'phosphor-react-native/src/icons/Desk';
import Chair from 'phosphor-react-native/src/icons/Chair';
import CookingPot from 'phosphor-react-native/src/icons/CookingPot';
import Oven from 'phosphor-react-native/src/icons/Oven';
import WashingMachine from 'phosphor-react-native/src/icons/WashingMachine';
import Drop from 'phosphor-react-native/src/icons/Drop';
import Car from 'phosphor-react-native/src/icons/Car';
import Motorcycle from 'phosphor-react-native/src/icons/Motorcycle';
import Bicycle from 'phosphor-react-native/src/icons/Bicycle';
import Waves from 'phosphor-react-native/src/icons/Waves';
import Barbell from 'phosphor-react-native/src/icons/Barbell';
import Tree from 'phosphor-react-native/src/icons/Tree';
import PawPrint from 'phosphor-react-native/src/icons/PawPrint';
import WifiHigh from 'phosphor-react-native/src/icons/WifiHigh';
import FireExtinguisher from 'phosphor-react-native/src/icons/FireExtinguisher';
import Broom from 'phosphor-react-native/src/icons/Broom';
import Archive from 'phosphor-react-native/src/icons/Archive';
import Plug from 'phosphor-react-native/src/icons/Plug';
import Lightning from 'phosphor-react-native/src/icons/Lightning';
import Bus from 'phosphor-react-native/src/icons/Bus';
import Train from 'phosphor-react-native/src/icons/Train';
import Park from 'phosphor-react-native/src/icons/Park';
import GraduationCap from 'phosphor-react-native/src/icons/GraduationCap';
import Hospital from 'phosphor-react-native/src/icons/Hospital';
import Flame from 'phosphor-react-native/src/icons/Flame';
import CoatHanger from 'phosphor-react-native/src/icons/CoatHanger';
import Door from 'phosphor-react-native/src/icons/Door';
import SwimmingPool from 'phosphor-react-native/src/icons/SwimmingPool';
import Plant from 'phosphor-react-native/src/icons/Plant';
import Cube from 'phosphor-react-native/src/icons/Cube';
import Garage from 'phosphor-react-native/src/icons/Garage';
import ChargingStation from 'phosphor-react-native/src/icons/ChargingStation';
import Shower from 'phosphor-react-native/src/icons/Shower';
import ForkKnife from 'phosphor-react-native/src/icons/ForkKnife';
import Wine from 'phosphor-react-native/src/icons/Wine';
import Toilet from 'phosphor-react-native/src/icons/Toilet';
import Thermometer from 'phosphor-react-native/src/icons/Thermometer';
import Wind from 'phosphor-react-native/src/icons/Wind';
import Elevator from 'phosphor-react-native/src/icons/Elevator';
import Wallet from 'phosphor-react-native/src/icons/Wallet';
import Files from 'phosphor-react-native/src/icons/Files';
import type { IconProps } from 'phosphor-react-native';
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
  siren: Siren,
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
  stairs: Stairs,
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
  lock: LockSimple,
  plus: Plus,
  pencil: PencilSimple,
  info: Info,
  'file-text': FileText,
  couch: Couch,
  armchair: Armchair,
  snowflake: Snowflake,
  fan: Fan,
  television: Television,
  desk: Desk,
  chair: Chair,
  'cooking-pot': CookingPot,
  oven: Oven,
  'washing-machine': WashingMachine,
  drop: Drop,
  car: Car,
  motorcycle: Motorcycle,
  bicycle: Bicycle,
  waves: Waves,
  barbell: Barbell,
  tree: Tree,
  paw: PawPrint,
  wifi: WifiHigh,
  'fire-extinguisher': FireExtinguisher,
  broom: Broom,
  archive: Archive,
  plug: Plug,
  lightning: Lightning,
  bus: Bus,
  train: Train,
  park: Park,
  'graduation-cap': GraduationCap,
  hospital: Hospital,
  flame: Flame,
  'coat-hanger': CoatHanger,
  door: Door,
  'swimming-pool': SwimmingPool,
  plant: Plant,
  cube: Cube,
  garage: Garage,
  'charging-station': ChargingStation,
  shower: Shower,
  'fork-knife': ForkKnife,
  wine: Wine,
  toilet: Toilet,
  thermometer: Thermometer,
  wind: Wind,
  elevator: Elevator,
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

export interface MobileIconProps {
  name: AppIconName;
  size?: number;
  tone?: AppIconTone;
  color?: string;
  weight?: IconProps['weight'];
}

export const MobileIcon: React.FC<MobileIconProps> = ({
  name,
  size = 22,
  tone = 'inactive',
  color,
  weight = 'regular',
}) => {
  if (name === 'house-plus') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
        <Path
          d="M12 20H3V10L12 2L20 9M19 13V21M15 17H23"
          stroke={color ?? TONE_COLORS[tone]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color ?? TONE_COLORS[tone]} weight={weight} />;
};
