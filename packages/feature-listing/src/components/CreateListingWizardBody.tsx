'use client';

import React, { useState } from 'react';
import { AppButton, AppInput, AppBadge, tokens } from '@nestyk/ui';
import { ListingEngineConfig } from '../config';

export interface CreateListingWizardBodyProps {
  config: ListingEngineConfig;
  onSubmitListing?: (data: any) => void;
}

/**
 * Pure Body Component for Listing Wizard (Shared across Owner & Agent)
 * Config-Driven Engine
 */
export const CreateListingWizardBody: React.FC<CreateListingWizardBodyProps> = ({
  config,
  onSubmitListing,
}) => {
  const [step, setStep] = useState<number>(1);
  const [title, setTitle] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [commission, setCommission] = useState<string>('3.0');

  const themeColor = tokens.colors.roles[config.actorRole];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0, color: tokens.colors.textHeading, fontFamily: 'var(--font-mitr), "Mitr", sans-serif', lineHeight: 1.45 }}>
            ลงประกาศปล่อยเช่า
          </h2>
          <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: '4px 0 0 0', lineHeight: 1.5, fontWeight: 400 }}>
            โหมด {config.themeTone === 'owner' ? 'เจ้าของห้องปล่อยเช่าเอง' : 'นายหน้า Co-Broke'}
          </p>
        </div>
        <AppBadge role={config.actorRole} label={`Step ${step}/3`} />
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', border: `1px solid ${tokens.colors.border}` }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AppInput
              label="ชื่อประกาศ / ชื่อโครงการ"
              placeholder="เช่น The Base Sukhumvit 77 ชั้น 15 วิวสระ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <AppInput
              label="ค่าเช่าต่อเดือน (บาท)"
              placeholder="เช่น 15000"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            {config.features.enableCommission && (
              <AppInput
                label="ค่าคอมมิชชั่นนายหน้า Co-Broke (%)"
                placeholder="3.0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                helperText="กำหนดส่วนแบ่งสำหรับ Agent Partner"
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <AppButton onClick={() => setStep(2)}>ถัดไป: AI ปรับแต่ง</AppButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: `1px dashed ${themeColor}` }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: themeColor, fontWeight: 500, fontFamily: 'var(--font-mitr), "Mitr", sans-serif' }}>
                ✨ AI Copywriting & Photo Enhancer
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5, fontWeight: 400 }}>
                Persona: {config.features.aiPersona === 'direct_owner' ? 'สำนวนเจ้าของปล่อยเช่าเอง' : 'สำนวนนายหน้ามืออาชีพ'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <AppButton variant="secondary" onClick={() => setStep(1)}>ย้อนกลับ</AppButton>
              <AppButton onClick={() => setStep(3)}>ถัดไป: เอกสารสิทธิ์</AppButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: tokens.colors.textHeading, fontWeight: 400, lineHeight: 1.5 }}>
                เอกสารที่ต้องแนบ: {config.features.docType === 'title_deed' ? 'สำเนาโฉนดที่ดิน/กรรมสิทธิ์ห้องชุด' : 'หนังสือมอบอำนาจ (Power of Attorney)'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <AppButton variant="secondary" onClick={() => setStep(2)}>ย้อนกลับ</AppButton>
              <AppButton
                onClick={() => {
                  onSubmitListing?.({ title, price, commission });
                  alert('บันทึกและส่งประกาศสำเร็จ');
                }}
              >
                ยืนยันการลงประกาศ
              </AppButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
