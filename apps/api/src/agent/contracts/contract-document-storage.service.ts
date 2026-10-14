import { validateSignaturePng } from './signature-image';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MOCK_RESERVATION_VERSION } from "./reservation-pdf";
import { BROKER_APPOINTMENT_VERSION } from "./broker-appointment-pdf";
import { LEASE_AGREEMENT_VERSION } from "./lease-agreement-pdf";
import { randomUUID } from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AgentContractDocumentKind } from "@nestyk/types";

export const MAX_CONTRACT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const CONTRACT_DOCUMENT_KINDS = [
  "lease_agreement",
  "invoice",
  "receipt",
] as const satisfies readonly AgentContractDocumentKind[];
const SIGNED_URL_SECONDS = 3600;

@Injectable()
export class ContractDocumentStorageService {
  private client?: SupabaseClient;
  private readonly bucket =
    process.env.SUPABASE_BUCKET_CONTRACTS || "contract-documents";
  private bucketReady?: Promise<void>;

  private async ensureBucket() {
    this.storage();
    this.bucketReady ??= (async () => {
      const storage = this.client!.storage;
      const { data, error } = await storage.listBuckets();
      if (error)
        throw new ServiceUnavailableException(
          "ไม่สามารถตรวจสอบที่เก็บเอกสารสัญญาได้",
        );
      const existing = data?.find((bucket) => bucket.name === this.bucket);
      if (existing?.public)
        throw new ServiceUnavailableException(
          "ที่เก็บเอกสารต้องเป็น private เท่านั้น",
        );
      if (existing) return;
      const { error: createError } = await storage.createBucket(this.bucket, {
        public: false,
        fileSizeLimit: MAX_CONTRACT_DOCUMENT_BYTES,
        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      });
      if (
        createError &&
        !createError.message.toLowerCase().includes("already exists")
      ) {
        throw new ServiceUnavailableException(
          "ไม่สามารถเตรียมที่เก็บเอกสารสัญญาได้",
        );
      }
    })().catch((error) => {
      this.bucketReady = undefined;
      throw error;
    });
    await this.bucketReady;
  }

  private storage() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    this.client ??= createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client.storage.from(this.bucket);
  }

  private sniff(buffer: Buffer) {
    if (
      buffer.length >= 5 &&
      buffer.subarray(0, 5).toString("latin1") === "%PDF-"
    )
      return { ext: "pdf", mime: "application/pdf" };
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    )
      return { ext: "jpg", mime: "image/jpeg" };
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return { ext: "png", mime: "image/png" };
    throw new BadRequestException("อัปโหลดได้เฉพาะไฟล์ PDF, JPEG หรือ PNG");
  }

  async upload(
    agentId: number,
    contractId: number,
    kind: AgentContractDocumentKind,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (
      !CONTRACT_DOCUMENT_KINDS.includes(
        kind as (typeof CONTRACT_DOCUMENT_KINDS)[number],
      )
    )
      throw new BadRequestException("ใบจองสร้างโดยระบบ ไม่รองรับการอัปโหลด");
    if (!file?.buffer?.length)
      throw new BadRequestException("กรุณาเลือกไฟล์เอกสาร");
    if (file.buffer.length > MAX_CONTRACT_DOCUMENT_BYTES)
      throw new BadRequestException("ไฟล์ต้องไม่เกิน 10 MB");
    const detected = this.sniff(file.buffer);
    await this.ensureBucket();
    const objectPath = `${agentId}/${contractId}/${kind}/${randomUUID()}.${detected.ext}`;
    const storage = this.storage();
    const { error } = await storage.upload(objectPath, file.buffer, {
      contentType: detected.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "อัปโหลดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path: objectPath };
  }

  async uploadAttachment(
    agentId: number,
    contractId: number,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException("กรุณาเลือกไฟล์เอกสาร");
    if (file.buffer.length > MAX_CONTRACT_DOCUMENT_BYTES)
      throw new BadRequestException("ไฟล์ต้องไม่เกิน 10 MB");
    const detected = this.sniff(file.buffer);
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/attachments/${randomUUID()}.${detected.ext}`;
    const { error } = await this.storage().upload(path, file.buffer, {
      contentType: detected.mime,
      upsert: false,
      cacheControl: "0",
    });
    if (error)
      throw new ServiceUnavailableException(
        "อัปโหลดเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path, mimeType: detected.mime, size: file.buffer.length };
  }

  async uploadSignature(
    agentId: number,
    contractId: number,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException("กรุณาวาดลายเซ็นก่อนยืนยัน");
    if (file.buffer.length > MAX_CONTRACT_DOCUMENT_BYTES)
      throw new BadRequestException("ไฟล์ต้องไม่เกิน 10 MB");
    const detected = this.sniff(file.buffer);
    if (detected.mime !== "image/png")
      throw new BadRequestException("ลายเซ็นต้องเป็นไฟล์ PNG");
    const png = await validateSignaturePng(file.buffer);
    await this.ensureBucket();
    const objectPath = `${agentId}/${contractId}/signatures/${randomUUID()}.png`;
    const { error } = await this.storage().upload(objectPath, png, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "บันทึกลายเซ็นไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path: objectPath };
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.storage().download(path);
    if (error || !data)
      throw new ServiceUnavailableException(
        "ไม่สามารถอ่านไฟล์เอกสารหรือลายเซ็นได้",
      );
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(path: string) {
    const { error } = await this.storage().remove([path]);
    if (error)
      throw new ServiceUnavailableException("ไม่สามารถลบไฟล์ชั่วคราวได้");
  }

  async uploadReservationPdf(
    agentId: number,
    contractId: number,
    pdf: Buffer,
    generated: boolean,
  ) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/${generated ? "generated" : "mock"}/reservation_letter/${MOCK_RESERVATION_VERSION}/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadBrokerAppointmentPdf(
    agentId: number,
    contractId: number,
    pdf: Buffer,
    generated: boolean,
  ) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/${generated ? "generated" : "mock"}/broker_appointment/${BROKER_APPOINTMENT_VERSION}/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadLeaseRenewalPdf(
    agentId: number,
    contractId: number,
    pdf: Buffer,
    generated: boolean,
  ) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/${generated ? "generated" : "mock"}/lease_renewal/v1/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadLeaseAgreementPdf(
    agentId: number,
    contractId: number,
    pdf: Buffer,
    generated: boolean,
  ) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/${generated ? "generated" : "mock"}/lease_agreement/${LEASE_AGREEMENT_VERSION}/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadStandaloneInvoice(agentId: number, pdf: Buffer) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/invoices/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadCommissionConfirmation(agentId: number, pdf: Buffer) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/commission-confirmations/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadPaymentSlip(
    agentId: number,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException("กรุณาแนบสลิปการชำระเงิน");
    if (file.buffer.length > MAX_CONTRACT_DOCUMENT_BYTES)
      throw new BadRequestException("ไฟล์ต้องไม่เกิน 10 MB");
    const detected = this.sniff(file.buffer);
    await this.ensureBucket();
    const path = `${agentId}/payment-slips/${randomUUID()}.${detected.ext}`;
    const { error } = await this.storage().upload(path, file.buffer, {
      contentType: detected.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "อัปโหลดสลิปไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadStandaloneReceipt(agentId: number, pdf: Buffer) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/receipts/${randomUUID()}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async uploadPartyPreview(
    agentId: number,
    contractId: number,
    formKind: string,
    pdf: Buffer,
  ) {
    if (
      this.sniff(pdf).mime !== "application/pdf" ||
      pdf.length > MAX_CONTRACT_DOCUMENT_BYTES
    )
      throw new BadRequestException("ไฟล์ PDF ไม่ถูกต้องหรือมีขนาดเกิน 10 MB");
    await this.ensureBucket();
    const path = `${agentId}/${contractId}/party-preview/${formKind}.pdf`;
    const { error } = await this.storage().upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error)
      throw new ServiceUnavailableException(
        "สร้างเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    return { path };
  }

  async signPaths(paths: Array<string | null | undefined>) {
    const unique = [...new Set(paths.filter((path): path is string => !!path))];
    const signed = new Map<string, string>();
    if (!unique.length) return signed;
    await this.ensureBucket();
    const { data, error } = await this.storage().createSignedUrls(
      unique,
      SIGNED_URL_SECONDS,
    );
    if (error)
      throw new ServiceUnavailableException(
        "ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง",
      );
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
    }
    return signed;
  }
}
