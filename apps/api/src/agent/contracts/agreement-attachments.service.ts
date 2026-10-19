import type { ContractParty } from "@nestyk/types";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
  AgreementAttachment,
  AgreementAttachmentChecklist,
  AgreementDocumentSubject,
  BrokerAppointmentInput,
} from "@nestyk/types";
import {
  AgreementDocumentEntity,
  AgreementDocumentRequirementEntity,
  MasterDocumentTypeEntity,
} from "../../entities/agreement-document.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { PropertyOwnerEntity } from "../../entities/property-owner.entity";
import { UserEntity } from "../../entities/user.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { ContractDocumentStorageService } from "./contract-document-storage.service";
import {
  validateBrokerAppointment,
  brokerAppointmentSnapshot,
  pickBrokerRentFromRoom,
} from "./broker-appointment";
import { createBrokerAppointmentPdf } from "./broker-appointment-pdf";

const subjects = ["tenant", "owner", "property", "representative"];
/** True once the stamped reservation letter PDF has been written. */
export function reservationLetterFinalized(c: LeaseContractEntity) {
  return !!(
    c.document_url?.includes("/generated/reservation_letter/") &&
    c.document_url.endsWith(".pdf")
  );
}
export function documentsEditable(c: LeaseContractEntity) {
  if (reservationLetterFinalized(c)) return false;
  return ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
    c.status,
  );
}
export function attachmentChecklist(
  requirements: AgreementDocumentRequirementEntity[],
  docs: AgreementDocumentEntity[],
) {
  const superseded = new Set(docs.map((d) => d.supersedes_document_id));
  const groups = new Map<
    string,
    AgreementAttachmentChecklist["requirements"][number]
  >();
  for (const r of requirements) {
    const group = groups.get(r.group_key) ?? {
      groupKey: r.group_key,
      label: r.label,
      subject: r.subject as AgreementDocumentSubject,
      documentTypeCodes: [],
      complete: false,
    };
    group.documentTypeCodes.push(r.document_type_code);
    group.complete ||= docs.some(
      (d) =>
        !d.removed_at &&
        !superseded.has(d.id) &&
        d.subject === r.subject &&
        d.document_type_code === r.document_type_code,
    );
    groups.set(r.group_key, group);
  }
  return [...groups.values()];
}
function optionalId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const id =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || Number(id) < 1 || Number(id) > 2147483647)
    throw new BadRequestException("รหัสเอกสารไม่ถูกต้อง");
  return Number(id);
}
export function validateAttachmentInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุรายละเอียดเอกสาร");
  const b = input as Record<string, unknown>;
  if (
    typeof b.documentTypeCode !== "string" ||
    !/^[a-z0-9_]{1,64}$/.test(b.documentTypeCode) ||
    typeof b.subject !== "string" ||
    !subjects.includes(b.subject)
  )
    throw new BadRequestException("ประเภทหรือเจ้าของเอกสารไม่ถูกต้อง");
  return {
    documentTypeCode: b.documentTypeCode,
    subject: String(b.subject),
    supersedesDocumentId: optionalId(b.supersedesDocumentId),
  };
}
@Injectable()
export class AgreementAttachmentsService {
  constructor(
    private readonly db: DataSource,
    private readonly storage: ContractDocumentStorageService,
  ) {}
  private async contract(
    agentId: number,
    id: number,
    manager = this.db.manager,
    lock = false,
  ) {
    const c = await manager.findOne(LeaseContractEntity, {
      where: { id, created_by_user_id: agentId },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    });
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return c;
  }
  private mutable(c: LeaseContractEntity) {
    if (!documentsEditable(c))
      throw new BadRequestException(
        "สร้างเอกสารหรือปิดสัญญาแล้ว จึงแก้ไขเอกสารแนบไม่ได้",
      );
  }
  private rows(id: number, manager = this.db.manager) {
    return manager.find(AgreementDocumentEntity, {
      where: { agreement_id: id },
      order: { id: "ASC" },
    });
  }
  private serialize(
    d: AgreementDocumentEntity,
    docs: AgreementDocumentEntity[],
  ): AgreementAttachment {
    return {
      id: d.id,
      agreementId: d.agreement_id,
      documentTypeCode: d.document_type_code,
      subject: d.subject as AgreementDocumentSubject,
      fileName: d.file_name,
      mimeType: d.mime_type,
      byteSize: d.byte_size,
      createdAt: d.created_at.toISOString(),
      reviewStatus: d.review_status,
      reviewNote: d.review_note,
      reviewedAt: d.reviewed_at?.toISOString() ?? null,
      supersedesDocumentId: d.supersedes_document_id,
      sourceDocumentId: d.source_document_id,
      isCurrent: !d.removed_at && !docs.some((next) => next.supersedes_document_id === d.id),
    };
  }
  async list(
    agentId: number,
    id: number,
  ): Promise<AgreementAttachmentChecklist> {
    return this.checklist(await this.contract(agentId, id), agentId);
  }
  async checklistForContract(c: LeaseContractEntity) {
    return this.checklist(c);
  }
  async uploadForParty(
    c: LeaseContractEntity,
    uploaderId: number,
    allowedSubjects: ContractParty[],
    input: unknown,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    const b = validateAttachmentInput(input);
    if (!allowedSubjects.includes(b.subject as ContractParty))
      throw new BadRequestException("แนบได้เฉพาะเอกสารของฝ่ายคุณ");
    this.mutable(c);
    const stored = await this.storage.uploadAttachment(
      c.created_by_user_id,
      c.id,
      file,
    );
    try {
      await this.insert(
        c.created_by_user_id,
        c.id,
        b,
        stored,
        file?.originalname ?? "document",
        null,
        uploaderId,
      );
    } catch (e) {
      await this.storage.remove(stored.path).catch(() => undefined);
      throw e;
    }
    return this.checklist(c);
  }
  async urlForContract(c: LeaseContractEntity, documentId: number) {
    const d = await this.db.manager.findOneBy(AgreementDocumentEntity, {
      id: documentId,
      agreement_id: c.id,
    });
    if (!d || d.removed_at) throw new NotFoundException("ไม่พบเอกสาร");
    this.assertPath(d, c.created_by_user_id);
    const signed = await this.storage.signPaths([d.file_path]);
    const url = signed.get(d.file_path);
    if (!url)
      throw new BadRequestException("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
    return { url };
  }
  private async checklist(
    c: LeaseContractEntity,
    agentId?: number,
  ): Promise<AgreementAttachmentChecklist> {
    const [docs, requirements, types] = await Promise.all([
      this.rows(c.id),
      this.db.manager.find(AgreementDocumentRequirementEntity, {
        where: { template_id: c.template_id },
        order: { id: "ASC" },
      }),
      this.db.manager.find(MasterDocumentTypeEntity, {
        where: { is_active: true },
        order: { code: "ASC" },
      }),
    ]);
    const groups = attachmentChecklist(requirements, docs);
    let reusable: AgreementDocumentEntity[] = [];
    if (agentId && c.previous_agreement_id) {
      const previous = await this.contract(agentId, c.previous_agreement_id);
      if (
        previous.tenant_id === c.tenant_id &&
        previous.rent_room_id === c.rent_room_id
      )
        reusable = await this.rows(previous.id);
    }
    return {
      editable: documentsEditable(c),
      readyToSign: groups.every((g) => g.complete),
      requirements: groups,
      documentTypes: types.map((t) => ({ code: t.code, nameTh: t.name_th })),
      documents: docs.filter((d) => !d.removed_at).map((d) => this.serialize(d, docs)),
      reusableDocuments: reusable
        .filter(
          (d) =>
            !d.removed_at &&
            !reusable.some((n) => n.supersedes_document_id === d.id),
        )
        .map((d) => this.serialize(d, reusable)),
    };
  }
  async assertReady(c: LeaseContractEntity) {
    if ((await this.groups(c)).some((g) => !g.complete))
      throw new BadRequestException(
        "กรุณาแนบเอกสารที่จำเป็นให้ครบก่อนลงนาม",
      );
  }
  async assertReadyForSubject(
    c: LeaseContractEntity,
    subject: ContractParty,
  ) {
    if (
      (await this.groups(c)).some((g) => g.subject === subject && !g.complete)
    )
      throw new BadRequestException("กรุณาแนบเอกสารของคุณให้ครบก่อนลงนาม");
  }
  private async groups(c: LeaseContractEntity) {
    return attachmentChecklist(
      await this.db.manager.find(AgreementDocumentRequirementEntity, {
        where: { template_id: c.template_id },
      }),
      await this.rows(c.id),
    );
  }
  async url(agentId: number, id: number, documentId: number) {
    await this.contract(agentId, id);
    const d = await this.db.manager.findOneBy(AgreementDocumentEntity, {
      id: documentId,
      agreement_id: id,
    });
    if (!d || d.removed_at) throw new NotFoundException("ไม่พบเอกสาร");
    this.assertPath(d, agentId);
    const signed = await this.storage.signPaths([d.file_path]);
    const url = signed.get(d.file_path);
    if (!url)
      throw new BadRequestException("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
    return { url };
  }
  private assertPath(d: AgreementDocumentEntity, agentId: number) {
    if (!d.file_path.startsWith(`${agentId}/${d.agreement_id}/attachments/`))
      throw new BadRequestException("ไฟล์ไม่ตรงกับสัญญา");
  }
  private async insert(
    agentId: number,
    id: number,
    input: ReturnType<typeof validateAttachmentInput>,
    file: { path: string; mimeType: string; size: number },
    name: string,
    source: AgreementDocumentEntity | null,
    uploaderId = agentId,
  ) {
    return this.db.transaction(async (manager) => {
      const c = await this.contract(agentId, id, manager, true);
      this.mutable(c);
      const type = await manager.findOneBy(MasterDocumentTypeEntity, {
        code: input.documentTypeCode,
        is_active: true,
      });
      if (!type) throw new BadRequestException("ประเภทเอกสารนี้ไม่เปิดใช้งาน");
      if (source && source.agreement_id !== c.previous_agreement_id)
        throw new BadRequestException("ใช้ได้เฉพาะเอกสารจากสัญญาก่อนหน้า");
      if (input.supersedesDocumentId) {
        const old = await manager.findOneBy(AgreementDocumentEntity, {
          id: input.supersedesDocumentId,
          agreement_id: id,
          subject: input.subject,
          document_type_code: input.documentTypeCode,
        });
        if (!old || old.removed_at)
          throw new BadRequestException(
            "เอกสารที่แทนที่ไม่ตรงกับสัญญาหรือประเภท",
          );
        if (
          await manager.findOneBy(AgreementDocumentEntity, {
            supersedes_document_id: old.id,
          })
        )
          throw new ConflictException(
            "เอกสารนี้มีฉบับใหม่แล้ว กรุณาโหลดอีกครั้ง",
          );
      }
      return manager.save(
        AgreementDocumentEntity,
        manager.create(AgreementDocumentEntity, {
          agreement_id: id,
          document_type_code: input.documentTypeCode,
          subject: input.subject,
          file_path: file.path,
          file_name:
            name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 255) || "document",
          mime_type: file.mimeType,
          byte_size: file.size,
          uploaded_by_user_id: uploaderId,
          review_status: "pending",
          supersedes_document_id: input.supersedesDocumentId,
          source_document_id: source?.id ?? null,
        }),
      );
    });
  }
  async upload(
    agentId: number,
    id: number,
    input: unknown,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    const b = validateAttachmentInput(input);
    this.mutable(await this.contract(agentId, id));
    const stored = await this.storage.uploadAttachment(agentId, id, file);
    try {
      await this.insert(
        agentId,
        id,
        b,
        stored,
        file?.originalname ?? "document",
        null,
      );
    } catch (e) {
      await this.storage.remove(stored.path).catch(() => undefined);
      throw e;
    }
    return this.list(agentId, id);
  }
  async remove(agentId: number, id: number, documentId: number) {
    await this.db.transaction(async (manager) => {
      const c = await this.contract(agentId, id, manager, true);
      this.mutable(c);
      const docs = await this.rows(id, manager);
      const current = docs.filter((d) => !d.removed_at &&
        !docs.some((next) => next.supersedes_document_id === d.id));
      const document = current.find((d) => d.id === documentId);
      if (!document) throw new NotFoundException("ไม่พบเอกสารเพิ่มเติม");
      const requirements = await manager.find(AgreementDocumentRequirementEntity, {
        where: { template_id: c.template_id }, order: { id: "ASC" },
      });
      const groups = attachmentChecklist(requirements, docs);
      if (groups.some((group) => current.find((d) =>
        d.subject === group.subject && group.documentTypeCodes.includes(d.document_type_code)
      )?.id === documentId)) {
        throw new BadRequestException("เอกสารที่จำเป็นให้ใช้ปุ่มอัปโหลดใหม่");
      }
      await manager.update(AgreementDocumentEntity, { id: documentId, agreement_id: id }, {
        removed_at: new Date(),
      });
    });
    return this.list(agentId, id);
  }
  async review(
    agentId: number,
    id: number,
    documentId: number,
    input: unknown,
  ) {
    const b = input as { status?: unknown; note?: unknown } | null;
    if (
      !b ||
      Array.isArray(b) ||
      typeof b.status !== "string" ||
      !["accepted", "rejected"].includes(b.status) ||
      (b.note != null && (typeof b.note !== "string" || b.note.length > 1000))
    )
      throw new BadRequestException("ผลตรวจเอกสารไม่ถูกต้อง");
    await this.db.transaction(async (manager) => {
      this.mutable(await this.contract(agentId, id, manager, true));
      const d = await manager.findOneBy(AgreementDocumentEntity, {
        id: documentId,
        agreement_id: id,
      });
      if (!d || d.removed_at) throw new NotFoundException("ไม่พบเอกสาร");
      if (
        d.review_status !== "pending" ||
        (await manager.findOneBy(AgreementDocumentEntity, {
          supersedes_document_id: d.id,
        }))
      )
        throw new ConflictException("เอกสารนี้ตรวจแล้วหรือมีฉบับใหม่แล้ว");
      await manager.update(
        AgreementDocumentEntity,
        { id: d.id },
        {
          review_status: b.status as "accepted" | "rejected",
          reviewed_by_user_id: agentId,
          reviewed_at: new Date(),
          review_note: typeof b.note === "string" ? b.note.trim() : null,
        },
      );
    });
    return this.list(agentId, id);
  }
  async reuse(agentId: number, id: number, input: unknown) {
    const b = input as {
      sourceDocumentId?: unknown;
      confirmedCurrent?: unknown;
    } | null;
    if (!b || b.confirmedCurrent !== true)
      throw new BadRequestException("กรุณายืนยันว่าเอกสารเดิมยังเป็นปัจจุบัน");
    const sourceId = optionalId(b.sourceDocumentId);
    if (!sourceId) throw new BadRequestException("กรุณาเลือกเอกสารเดิม");
    const c = await this.contract(agentId, id);
    this.mutable(c);
    if (!c.previous_agreement_id)
      throw new BadRequestException("สัญญานี้ไม่มีฉบับก่อนหน้า");
    const previous = await this.contract(agentId, c.previous_agreement_id);
    if (
      previous.tenant_id !== c.tenant_id ||
      previous.rent_room_id !== c.rent_room_id
    )
      throw new BadRequestException("ผู้เช่าหรือห้องไม่ตรงกับสัญญาเดิม");
    const docs = await this.rows(previous.id);
    const source = docs.find(
      (d) =>
        d.id === sourceId &&
        !d.removed_at &&
        !docs.some((n) => n.supersedes_document_id === d.id),
    );
    if (!source)
      throw new NotFoundException("ไม่พบเอกสารเดิมฉบับปัจจุบัน");
    this.assertPath(source, agentId);
    const buffer = await this.storage.download(source.file_path);
    const stored = await this.storage.uploadAttachment(agentId, id, {
      buffer,
      size: buffer.length,
    });
    try {
      await this.insert(
        agentId,
        id,
        {
          documentTypeCode: source.document_type_code,
          subject: source.subject,
          supersedesDocumentId: null,
        },
        stored,
        source.file_name,
        source,
      );
    } catch (e) {
      await this.storage.remove(stored.path).catch(() => undefined);
      throw e;
    }
    return this.list(agentId, id);
  }

  private async contractDetail(agentId: number, id: number) {
    const c = await this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.tenant", "tenant")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.template", "template")
      .where("c.id = :id AND c.created_by_user_id = :agentId", { id, agentId })
      .getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return c;
  }

  async brokerAppointmentDefaults(
    agentId: number,
    id: number,
  ): Promise<BrokerAppointmentInput> {
    const c = await this.contractDetail(agentId, id);
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation")
      throw new BadRequestException(
        "สร้างสัญญาแต่งตั้งนายหน้าได้เฉพาะหนังสือจอง",
      );
    this.mutable(c);
    const snapshot = c.party_snapshot ?? {};
    const property = c.rent_room?.property;
    const owner = c.rent_room?.property_owner_id
      ? await this.db
          .getRepository(PropertyOwnerEntity)
          .findOneBy({ id: c.rent_room.property_owner_id })
      : null;
    const ownerUser = c.rent_room?.owner_id
      ? await this.db
          .getRepository(UserEntity)
          .findOneBy({ id: c.rent_room.owner_id })
      : null;
    const agent = await this.db
      .getRepository(UserEntity)
      .findOneBy({ id: agentId });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const landlordName = String(
      snapshot.ownerName ??
        owner?.name ??
        (ownerUser
          ? `${ownerUser.first_name ?? ""} ${ownerUser.last_name ?? ""}`.trim()
          : "") ??
        "",
    );
    const brokerContact = agent
      ? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()
      : "";
    const address = property
      ? [property.address, property.subdistrict, property.district, property.province, property.postal_code]
          .map((part) => (typeof part === "string" ? part.trim() : ""))
          .filter((part) => part && part !== "-")
          .join(", ")
      : "";
    const propertyName =
      property?.name || c.rent_room?.listing_title || String(snapshot.property ?? "");
    const room = c.rent_room?.room_id || String(snapshot.room ?? "");
    const propertyLine = [propertyName, room ? `ห้อง ${room}` : "", address]
      .filter(Boolean)
      .join(" · ");
    const saved = (c.data?.brokerAppointment ?? null) as
      | Partial<BrokerAppointmentInput>
      | null;
    if (saved?.documentNo)
      return {
        documentNo: String(saved.documentNo ?? ""),
        issueDate: String(saved.issueDate || today),
        landlordName: String(saved.landlordName ?? ""),
        landlordFirstName: String(saved.landlordFirstName ?? ""),
        landlordLastName: String(saved.landlordLastName ?? ""),
        landlordNationality: String(saved.landlordNationality ?? ""),
        landlordId: String(saved.landlordId ?? ""),
        landlordAddress: String(saved.landlordAddress ?? ""),
        landlordPhone: String(saved.landlordPhone ?? ""),
        brokerCompany: String(saved.brokerCompany ?? ""),
        brokerContact: String(saved.brokerContact ?? ""),
        brokerNationality: String(saved.brokerNationality ?? ""),
        brokerId: String(saved.brokerId ?? ""),
        brokerPhone: String(saved.brokerPhone ?? ""),
        brokerAddress: String(saved.brokerAddress ?? ""),
        propertyLine: String(saved.propertyLine ?? ""),
        monthlyRent: String(saved.monthlyRent ?? ""),
        leaseMonths: String(saved.leaseMonths ?? ""),
        commissionFee: String(saved.commissionFee ?? ""),
        commissionMonths: String(saved.commissionMonths ?? ""),
        landlordSignName: String(saved.landlordSignName ?? ""),
        brokerSignName: String(saved.brokerSignName ?? ""),
        landlordSignaturePng: "",
        brokerSignaturePng: "",
      };
    const pricedRoom = c.rent_room_id
      ? await this.db.getRepository(RentRoomEntity).findOne({
          where: { id: c.rent_room_id },
          relations: { price_rows: { contract_type: true } },
        })
      : null;
    const lead = c.lead_id
      ? await this.db.getRepository(LeadEntity).findOneBy({ id: c.lead_id })
      : null;
    const { monthlyRent, leaseMonths } = pickBrokerRentFromRoom(
      pricedRoom ?? c.rent_room,
      lead?.lease_duration_months,
    );
    return {
      documentNo: `BA-${c.contract_no || c.id}`,
      issueDate: today,
      landlordName,
      landlordFirstName: String(snapshot.ownerFirstName ?? ""),
      landlordLastName: String(snapshot.ownerLastName ?? ""),
      landlordNationality: String(snapshot.ownerNationality ?? ""),
      landlordId: String(snapshot.ownerTaxId ?? snapshot.ownerIdNumber ?? ""),
      landlordAddress: String(snapshot.ownerAddress ?? address),
      landlordPhone: String(
        snapshot.ownerPhone ?? owner?.phone ?? ownerUser?.phone ?? "",
      ),
      brokerCompany: "NESTYK",
      brokerContact,
      brokerNationality: "ไทย",
      brokerId: "",
      brokerPhone: agent?.phone ?? "",
      brokerAddress: "",
      propertyLine,
      monthlyRent,
      leaseMonths,
      commissionFee: "",
      commissionMonths: "",
      landlordSignName: landlordName,
      brokerSignName: brokerContact,
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
  }

  async generateBrokerAppointment(
    agentId: number,
    id: number,
    input: unknown,
  ) {
    const c = await this.contractDetail(agentId, id);
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation")
      throw new BadRequestException(
        "สร้างสัญญาแต่งตั้งนายหน้าได้เฉพาะหนังสือจอง",
      );
    this.mutable(c);
    const data = validateBrokerAppointment(input);
    let bytes: Buffer;
    try {
      bytes = await createBrokerAppointmentPdf(data);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ",
      );
    }
    const docs = await this.rows(id);
    const superseded = new Set(docs.map((d) => d.supersedes_document_id));
    const current = docs.find(
      (d) =>
        !d.removed_at &&
        !superseded.has(d.id) &&
        d.document_type_code === "power_of_attorney" &&
        d.subject === "representative",
    );
    const stored = await this.storage.uploadAttachment(agentId, id, {
      buffer: bytes,
      size: bytes.length,
    });
    try {
      await this.insert(
        agentId,
        id,
        {
          documentTypeCode: "power_of_attorney",
          subject: "representative",
          supersedesDocumentId: current?.id ?? null,
        },
        stored,
        `broker-appointment-${data.documentNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
        null,
      );
      await this.db.getRepository(LeaseContractEntity).update(
        { id, created_by_user_id: agentId },
        {
          data: {
            ...(c.data ?? {}),
            brokerAppointment: brokerAppointmentSnapshot(data),
          },
        },
      );
    } catch (e) {
      await this.storage.remove(stored.path).catch(() => undefined);
      throw e;
    }
    return this.list(agentId, id);
  }
}
