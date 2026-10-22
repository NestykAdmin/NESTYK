'use client';

import React from 'react';
import { AppButton, AppInput, AppBadge, AppIcon, tokens } from '@nestyk/ui';
import { SmartAppBanner } from '../components/SmartAppBanner';
import { MOCK_LISTINGS, MOCK_HERO, MOCK_FEATURED } from '../../lib/mock-data';

export default function HomePage() {
  const handleDeepLink = (path: string) => {
    window.location.href = `nestyk://${path}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <SmartAppBanner />

      {/* Hero Search Section */}
      <section
        style={{
          padding: '48px 32px',
          borderRadius: '16px',
          backgroundColor: '#FFFFFF',
          border: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: tokens.colors.brand[700],
            backgroundColor: tokens.colors.brand[50],
            padding: '6px 14px',
            borderRadius: '20px',
            border: `1px solid ${tokens.colors.brand[100]}`,
          }}
        >
          {MOCK_HERO.badge}
        </span>
        <h1
          style={{
            fontSize: '34px',
            fontWeight: 500,
            margin: 0,
            color: tokens.colors.textHeading,
            fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
            lineHeight: 1.4,
          }}
        >
          {MOCK_HERO.title}
        </h1>
        <p style={{ fontSize: '15px', color: tokens.colors.textSecondary, margin: 0, maxWidth: '640px', lineHeight: 1.6, fontWeight: 400 }}>
          {MOCK_HERO.subtitle}
        </p>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '640px', marginTop: '10px' }}>
          <AppInput placeholder={MOCK_HERO.searchPlaceholder} />
          <AppButton style={{ minWidth: '120px' }}>{MOCK_HERO.searchButton}</AppButton>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 500,
                color: tokens.colors.textHeading,
                margin: 0,
                fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
                lineHeight: 1.4,
              }}
            >
              {MOCK_FEATURED.title}
            </h2>
            <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '4px 0 0 0', fontWeight: 400 }}>
              {MOCK_FEATURED.subtitle}
            </p>
          </div>
          <span style={{ fontSize: '13px', color: tokens.colors.textSecondary, fontWeight: 500 }}>
            พบ {MOCK_LISTINGS.length} รายการ
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '20px',
          }}
        >
          {MOCK_LISTINGS.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: `1px solid ${tokens.colors.border}`,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppBadge role={item.role}>{item.tag}</AppBadge>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: tokens.colors.primary,
                    fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
                  }}
                >
                  {item.price} <span style={{ fontSize: '13px', fontWeight: 400, color: tokens.colors.textSecondary }}>฿/ด.</span>
                </span>
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    margin: '0 0 4px 0',
                    color: tokens.colors.textHeading,
                    fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
                    lineHeight: 1.4,
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0, fontWeight: 400 }}>
                  {item.roomType}
                </p>
              </div>

              <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0, lineHeight: 1.5, flex: 1, fontWeight: 400 }}>
                {item.desc}
              </p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <AppButton
                  variant="outline"
                  onClick={() => handleDeepLink(`viewing/${item.id}`)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <AppIcon name="calendar-plus" size={15} tone="active" />
                  {MOCK_FEATURED.scheduleViewing}
                </AppButton>
                <AppButton
                  onClick={() => handleDeepLink(`listing/${item.id}`)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                >
                  {MOCK_FEATURED.viewDetails}
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
