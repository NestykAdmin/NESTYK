'use client';

import React, { useState } from 'react';
import { AppButton, AppIcon, NestykLogo, tokens } from '@nestyk/ui';

export interface SmartAppBannerProps {
  defaultScheme?: string;
}

export const SmartAppBanner: React.FC<SmartAppBannerProps> = ({
  defaultScheme = 'nestyk://',
}) => {
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [currentDeepLink, setCurrentDeepLink] = useState<string>(defaultScheme);

  const handleOpenApp = (scheme: string) => {
    setCurrentDeepLink(scheme);
    // พยายามเปิด Native Deep Link Scheme
    window.location.href = scheme;
    // Fallback: ถ้าไม่ได้เปิดบนมือถือหรือไม่เด้งเข้า ให้แสดง QR Code หรือ Pop-up แนะนำ
    setTimeout(() => {
      setShowQrModal(true);
    }, 1200);
  };

  return (
    <>
      <div
        style={{
          backgroundColor: '#211E1E',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <NestykLogo variant="markOnDark" height={38} style={{ borderRadius: 10 }} />
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: '14px', letterSpacing: '0.2px' }}>
              ใช้งานเต็มรูปแบบบนแอป NESTYK
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 400 }}>
              ค้นหาด้วย GPS • จัดการสัญญาและบิล • โหมดเจ้าของห้องและนายหน้า Co-Broke
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => handleOpenApp('nestyk://tenant')}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#BBF7D0',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="home" size={14} color="#BBF7D0" />
            โหมดผู้เช่า
          </button>
          <button
            onClick={() => handleOpenApp('nestyk://owner')}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#BFDBFE',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="key" size={14} color="#BFDBFE" />
            โหมดเจ้าของห้อง
          </button>
          <button
            onClick={() => handleOpenApp('nestyk://agent')}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#F8B615',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="handshake" size={14} color="#F8B615" />
            โหมดนายหน้า
          </button>
          <AppButton
            onClick={() => handleOpenApp('nestyk://guest')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="grid" size={15} color={tokens.colors.primary} />
            เปิดในแอป
          </AppButton>
        </div>
      </div>

      {/* QR / Download Fallback Modal */}
      {showQrModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <AppIcon name="qr-code" size={32} tone="accent" />
            <h3 style={{ margin: 0, fontSize: '18px', color: tokens.colors.textHeading, fontWeight: 500 }}>
              เปิดใช้งานบนแอป NESTYK
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
              สแกน QR Code หรือเปิดผ่านแอปบน iOS / Android เพื่อเข้าถึงสัญญาดิจิทัล บิลค่าเช่า และสต็อก Co-Broke
            </p>

            <div
              style={{
                padding: '16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: `1px solid ${tokens.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  backgroundColor: '#E2E8F0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: tokens.colors.textSecondary,
                }}
              >
                [ QR Code Scheme ]
              </div>
              <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, fontFamily: 'monospace' }}>
                {currentDeepLink}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <AppButton variant="outline" style={{ flex: 1 }} onClick={() => setShowQrModal(false)}>
                ปิด
              </AppButton>
              <AppButton
                style={{ flex: 1 }}
                onClick={() => {
                  window.location.href = currentDeepLink;
                }}
              >
                ลองเปิดใหม่อีกครั้ง
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
