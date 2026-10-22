import React from 'react';
import { ServiceCatalogBody } from '@nestyk/feature-services';
import { AppBadge, tokens } from '@nestyk/ui';

export default function AdminHomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: 0, color: tokens.colors.textHeading, fontFamily: 'var(--font-mitr), "Mitr", sans-serif' }}>
            Operations & Service Dispatcher
          </h1>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '4px 0 0 0', fontWeight: 400 }}>
            ศูนย์รับเรื่องและควบคุมคุณภาพบริการส่วนกลาง
          </p>
        </div>
        <AppBadge role="admin" label="Backoffice Live" />
      </div>

      <ServiceCatalogBody currentRole="admin" />
    </div>
  );
}
