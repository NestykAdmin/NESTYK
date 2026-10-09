/**
 * แผ่นเลือกภาษา (Page Object)
 *
 * เปิดจากปุ่มภาษาบนหน้า login เป็นแผ่นที่เลื่อนขึ้นจากด้านล่าง มีตัวเลือก 4 ภาษา
 * ชื่อของตัวเลือกเหมือนกันทุกภาษาของแอป (ไทย, English, 中文, 日本語) เลือกแล้วแผ่นปิดเอง
 * ที่มา: packages/ui/src/components/MobileLanguagePickerBody.tsx บรรทัด 65 ถึง 84 และ MobileBottomSheet.tsx บรรทัด 72 ถึง 90
 */
import { LANGUAGE_NAMES, LANGUAGE_OPTIONS, type LanguageOption } from '../labels/index';
import { type ElementSpec, isShown, tap, waitUntilGone } from './locators';

export class LanguageSheet {
  private option(language: LanguageOption): ElementSpec {
    return {
      description: `ตัวเลือกภาษา ${LANGUAGE_NAMES[language]}`,
      testId: `language.option.${language}`,
      labels: [LANGUAGE_NAMES[language]],
    };
  }

  /**
   * ตัวเลือกภาษาที่ผู้ใช้เห็นอยู่ ณ ตอนที่ถาม เรียงตามลำดับใน LANGUAGE_OPTIONS (รายการว่าง = ไม่เห็นแผ่น)
   * ระหว่างที่แผ่นกำลังเลื่อนขึ้น อาจเห็นไม่ครบ เทสจึงควรอ่านซ้ำจนได้ค่าที่คาด (readUntil)
   */
  async shownOptions(): Promise<LanguageOption[]> {
    const shown: LanguageOption[] = [];
    for (const language of LANGUAGE_OPTIONS) {
      if (await isShown(this.option(language))) shown.push(language);
    }
    return shown;
  }

  /** เลือกภาษา (รอให้แผ่นเลื่อนขึ้นจนหยุดก่อนแตะ) แล้วรอจนแผ่นปิด */
  async choose(language: LanguageOption): Promise<void> {
    await tap(this.option(language));
    await waitUntilGone(this.option(language));
  }
}
