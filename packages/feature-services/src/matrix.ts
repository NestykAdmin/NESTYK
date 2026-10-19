import { ServiceCategory, UserRole } from '@nestyk/types';
import type { AppIconName } from '@nestyk/ui';

export interface ServicePermissionItem {
  category: ServiceCategory;
  titleTh: string;
  titleEn: string;
  icon: AppIconName;
  allowedRoles: UserRole[];
  descriptionTh: string;
}

export type ServiceHubActionId = 'tickets' | 'emergency' | 'move';

/** Mock phase: every role sees the same service catalog */
const ALL_SERVICE_ROLES: UserRole[] = ['guest', 'tenant', 'landlord', 'agent', 'admin'];

export interface ServiceHubExtraTile {
  id: ServiceHubActionId;
  titleEn: string;
  icon: AppIconName;
  allowedRoles: UserRole[];
  highlight?: boolean;
}

export const servicesMatrix: ServicePermissionItem[] = [
  {
    category: 'viewing',
    titleTh: 'นัดหมายดูห้อง',
    titleEn: 'Viewing',
    icon: 'calendar',
    allowedRoles: ALL_SERVICE_ROLES,
    descriptionTh: 'ส่งคำขอนัดดูห้อง หรือมอบหมายงานพาชม',
  },
  {
    category: 'cleaning',
    titleTh: 'บริการทำความสะอาด',
    titleEn: 'Cleaning',
    icon: 'sparkle',
    allowedRoles: ALL_SERVICE_ROLES,
    descriptionTh: 'ทำความสะอาดประจำรอบ หรือ Deep Clean ก่อนส่งมอบห้อง',
  },
  {
    category: 'maintenance',
    titleTh: 'แจ้งซ่อมบำรุง',
    titleEn: 'Repair',
    icon: 'wrench',
    allowedRoles: ALL_SERVICE_ROLES,
    descriptionTh: 'ซ่อมแอร์, ประปา, ไฟฟ้า และปรับปรุงห้องพัก',
  },
  {
    category: 'inspection',
    titleTh: 'ตรวจรับสภาพห้อง',
    titleEn: 'Inspect',
    icon: 'clipboard',
    allowedRoles: ALL_SERVICE_ROLES,
    descriptionTh: 'ตรวจสภาพห้องก่อนเข้าอยู่ หรือตรวจรับห้องก่อนย้ายออก',
  },
  {
    category: 'support',
    titleTh: 'แจ้งปัญหา / ช่วยเหลือ',
    titleEn: 'Support',
    icon: 'chat',
    allowedRoles: ALL_SERVICE_ROLES,
    descriptionTh: 'ศูนย์รับเรื่องร้องเรียนและประสานงานส่วนกลาง',
  },
];

export const serviceHubExtraTiles: ServiceHubExtraTile[] = [
  {
    id: 'tickets',
    titleEn: 'My Tickets',
    icon: 'ticket',
    allowedRoles: ALL_SERVICE_ROLES,
  },
  {
    id: 'emergency',
    titleEn: 'Emergency',
    icon: 'siren',
    allowedRoles: ALL_SERVICE_ROLES,
    highlight: true,
  },
  {
    id: 'move',
    titleEn: 'Move-in',
    icon: 'package',
    allowedRoles: ALL_SERVICE_ROLES,
  },
];
