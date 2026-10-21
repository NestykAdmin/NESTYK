'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type Preview = {
  party: 'owner' | 'tenant';
  partyLabel: string;
  contractNo: string | null;
  property: string;
  room: string | null;
  tenant: string;
  agreementTypeName: string;
  alreadySigned: boolean;
  signingBlockedReason: string | null;
  /** B3: attached documents the agent rejected; shown before signing (signing is not blocked). */
  rejectedAttachments?: Array<{ name: string; note: string | null }>;
  expiresAt: string;
};

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api/v1';

export default function PublicSignPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/public/contract-sign/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body?.message === 'string'
              ? body.message
              : 'เปิดลิงก์ลงนามไม่สำเร็จ',
          );
        }
        if (!cancelled) {
          setPreview(body as Preview);
          if ((body as Preview).alreadySigned) setDone(true);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'เปิดลิงก์ลงนามไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
  }

  async function submit() {
    if (preview?.signingBlockedReason) {
      setError(preview.signingBlockedReason);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) {
      setError('กรุณาวาดลายเซ็นก่อนยืนยัน');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/public/contract-sign/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ signaturePng: canvas.toDataURL('image/png') }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'บันทึกลายเซ็นไม่สำเร็จ',
        );
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกลายเซ็นไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 16px 48px',
        display: 'flex',
        justifyContent: 'center',
        background:
          'linear-gradient(180deg, #FFF8E7 0%, #F8FAFC 42%, #F8FAFC 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mitr), Mitr, sans-serif',
              fontSize: 13,
              color: '#64748B',
            }}
          >
            NESTYK E-CONTRACT
          </p>
          <h1
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mitr), Mitr, sans-serif',
              fontSize: 24,
              color: '#211E1E',
            }}
          >
            ลงนามเอกสาร
          </h1>
        </div>

        {loading ? (
          <p style={{ color: '#64748B' }}>กำลังโหลด...</p>
        ) : error && !preview ? (
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: '#FFFFFF',
              border: '1px solid #FECACA',
              color: '#DC2626',
            }}
          >
            {error}
          </div>
        ) : preview ? (
          <>
            <section
              style={{
                padding: 16,
                borderRadius: 16,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <strong style={{ color: '#334155' }}>{preview.agreementTypeName}</strong>
              <span style={{ color: '#64748B', fontSize: 14 }}>
                {preview.property}
                {preview.room ? ` · ห้อง ${preview.room}` : ''}
              </span>
              <span style={{ color: '#64748B', fontSize: 14 }}>
                ผู้เช่า: {preview.tenant}
                {preview.contractNo ? ` · ${preview.contractNo}` : ''}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#FFE29A',
                  color: '#211E1E',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ลงนามในฐานะ{preview.partyLabel}
              </span>
            </section>

            {done ? (
              <section
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                }}
              >
                บันทึกลายเซ็นแล้ว ขอบคุณที่ลงนาม สามารถปิดหน้านี้ได้
              </section>
            ) : preview.signingBlockedReason ? (
              <section style={{ padding: 20, borderRadius: 16, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                <p>{preview.signingBlockedReason}</p>
                <p>เปิดหนังสือจองในบัญชีผู้เช่าเพื่อดูใบแจ้งหนี้และอัปโหลดสลิปชำระค่าจอง</p>
                <button type="button" onClick={() => setRetry(value => value + 1)}>ตรวจสอบการชำระอีกครั้ง</button>
              </section>
            ) : (
              <section
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {preview.rejectedAttachments?.length ? (
                  <div
                    role="alert"
                    style={{ padding: 12, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 14 }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      เอกสารแนบที่นายหน้าตีกลับ {preview.rejectedAttachments.length} รายการ
                    </p>
                    <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                      {preview.rejectedAttachments.map((item, index) => (
                        <li key={index}>{item.note ? `${item.name}: ${item.note}` : item.name}</li>
                      ))}
                    </ul>
                    <p style={{ margin: 0 }}>ยังลงนามได้ แต่ควรอ่านเหตุผลก่อนลงนาม</p>
                  </div>
                ) : null}
                <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
                  วาดลายเซ็นในกรอบ แล้วกดยืนยันเพื่อส่งกลับเข้าสู่ระบบ
                </p>
                <canvas
                  ref={canvasRef}
                  width={720}
                  height={320}
                  style={{
                    width: '100%',
                    height: 220,
                    touchAction: 'none',
                    display: 'block',
                    borderRadius: 12,
                    border: '1px solid #CBD5E1',
                    background: '#FAFAFA',
                  }}
                  onPointerDown={(event) => {
                    const ctx = canvasRef.current?.getContext('2d');
                    const p = point(event);
                    if (!ctx || !p) return;
                    drawing.current = true;
                    ctx.strokeStyle = '#211E1E';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (!drawing.current) return;
                    const ctx = canvasRef.current?.getContext('2d');
                    const p = point(event);
                    if (!ctx || !p) return;
                    dirty.current = true;
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                  }}
                  onPointerUp={() => {
                    drawing.current = false;
                  }}
                  onPointerCancel={() => {
                    drawing.current = false;
                  }}
                />
                {error ? (
                  <p style={{ margin: 0, color: '#DC2626', fontSize: 14 }}>{error}</p>
                ) : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearPad}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      border: '1px solid #F8B615',
                      background: '#FFFFFF',
                      color: '#211E1E',
                      fontWeight: 600,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    ล้างลายเซ็น
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit()}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      border: 'none',
                      background: '#F8B615',
                      color: '#211E1E',
                      fontWeight: 700,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? 'กำลังบันทึก...' : 'ยืนยันลายเซ็น'}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
