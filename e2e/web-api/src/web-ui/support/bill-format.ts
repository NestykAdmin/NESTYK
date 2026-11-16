import type { Page } from '@playwright/test';
import { UI_LOCALE_TAG } from '../labels';

/**
 * ข้อความของเงิน เดือน และวันที่ ตามสูตรเดียวกับหน้าบิลของแอป (apps/consumer-app/lib/bill-format.ts:3-14 ที่ qa/e2e 5142425)
 *   แท็กภาษา: th → th-TH, en → en-GB (ค่าเดียวกับ UI_LOCALE_TAG ใน labels.ts)
 *   เงิน: Intl.NumberFormat ทศนิยมไม่เกิน 2 ตำแหน่ง ต่อท้าย " ฿" ทุกภาษา (:14)
 *   เดือน: month long + year numeric ของวันที่ 15 ของงวด YYYY-MM (:12-13)
 *   วันที่: day numeric + month short + year numeric ของ 10 ตัวแรกของค่า ตอน 12:00 เวลาของเครื่อง (:8-11)
 * คำนวณในเบราว์เซอร์ของหน้าเดียวกับที่เทสเปิด เพื่อให้ได้ข้อมูลภาษา (ICU) ชุดเดียวกับที่หน้าใช้ เช่น ปี พ.ศ. ของ th-TH
 * ข้อจำกัด: เทสที่ใช้ตัวช่วยนี้พิสูจน์ว่าหน้าใช้ช่องไหนของ API กับข้อความไหน ไม่ได้พิสูจน์ตัวสูตรจัดรูปแบบ (ใช้สูตรเดียวกัน)
 */
export interface BillTexts {
  /** ยอดเงิน เช่น "12,000 ฿" */
  amount(value: number): string;
  /** เดือนของงวด YYYY-MM เช่น "November 2026" */
  month(period: string): string;
  /** วันที่ตามที่แอปแสดง: ใช้ 10 ตัวแรกของค่า (ค่าเป็น YYYY-MM-DD หรือ ISO) */
  date(value: string): string;
  /** วันที่ของเวลา ISO ตามปฏิทินของกรุงเทพ ในรูปแบบเดียวกับ date (ใช้เมื่อค่าที่คาดคือ "วันตามเวลากรุงเทพ" ไม่ใช่ 10 ตัวแรกของค่า) */
  bangkokDate(iso: string): string;
}

export interface BillValues {
  amounts?: readonly number[];
  periods?: readonly string[];
  dates?: readonly string[];
  /** เวลาแบบ ISO ที่ต้องการวันตามเวลากรุงเทพ */
  instants?: readonly string[];
}

/** จัดรูปแบบค่าทั้งหมดที่เทสจะใช้ในครั้งเดียว ค่าที่ไม่ได้ส่งเข้ามา ตัวอ่านจะโยน error (แปลว่าเทสลืมเตรียมค่า ไม่ใช่ความผิดของหน้า) */
export async function billTexts(page: Page, values: BillValues): Promise<BillTexts> {
  const input = {
    tag: UI_LOCALE_TAG,
    amounts: [...new Set(values.amounts ?? [])],
    periods: [...new Set(values.periods ?? [])],
    dates: [...new Set(values.dates ?? [])],
    instants: [...new Set(values.instants ?? [])],
  };
  const output = await page.evaluate(({ tag, amounts, periods, dates, instants }) => {
    const date = (value: string): string =>
      new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
    // วันที่ YYYY-MM-DD ตามปฏิทินของกรุงเทพ (แอปใช้วิธีเดียวกันหา "วันนี้": TenantBillsBody.tsx:20-22)
    const bangkokDay = (iso: string): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    return {
      amounts: amounts.map((value) => `${new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(value)} ฿`),
      months: periods.map((period) => new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(new Date(`${period}-15T12:00:00`))),
      dates: dates.map(date),
      bangkokDates: instants.map((iso) => date(bangkokDay(iso))),
    };
  }, input);

  const reader = <K extends string | number>(keys: readonly K[], texts: readonly string[], what: string) => {
    const map = new Map<K, string>(keys.map((key, index) => [key, texts[index]]));
    return (key: K): string => {
      const text = map.get(key);
      if (text === undefined) throw new Error(`billTexts: ยังไม่ได้เตรียม${what}นี้ (เทสต้องส่งค่าเข้า billTexts ก่อนใช้)`);
      return text;
    };
  };
  return {
    amount: reader(input.amounts, output.amounts, 'ยอดเงิน'),
    month: reader(input.periods, output.months, 'งวด'),
    date: reader(input.dates, output.dates, 'วันที่'),
    bangkokDate: reader(input.instants, output.bangkokDates, 'เวลา'),
  };
}
