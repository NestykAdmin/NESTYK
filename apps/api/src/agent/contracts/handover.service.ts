import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource, EntityManager, IsNull, Not } from "typeorm";
import type {
  ContractParty,
  HandoverBlockedReason,
  HandoverItemCondition,
  HandoverItemInput,
  HandoverKind,
  HandoverRecord,
  HandoverSignParty,
} from "@nestyk/types";
import { bangkokToday } from "../../billing/rent-schedule";
import { AgreementSignatureEntity } from "../../entities/agreement-signature.entity";
import { HandoverItemEntity, HandoverPhotoEntity, HandoverRecordEntity } from "../../entities/handover.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { AgentContractsService } from "./agent-contracts.service";
import { ContractDocumentStorageService } from "./contract-document-storage.service";
import { isIsoDate } from "./lease-term";

export const HANDOVER_MAX_ITEMS = 100;
export const HANDOVER_MAX_PHOTOS = 30;
export const HANDOVER_SIGN_PARTIES = ["owner", "tenant"] as const satisfies readonly HandoverSignParty[];
const CONDITIONS: readonly HandoverItemCondition[] = ["good", "damaged", "missing"];

export const HANDOVER_BLOCKED_MESSAGES: Record<HandoverBlockedReason, string> = {
  not_lease: "ส่งมอบห้องได้เฉพาะสัญญาเช่า",
  contract_ended: "สัญญานี้สิ้นสุดแล้ว ส่งมอบห้องไม่ได้",
  lease_not_issued: "ต้องออกเอกสารสัญญาเช่าก่อน จึงจะส่งมอบห้องได้",
  deposit_unpaid: "ต้องออกใบเสร็จเงินประกันก่อน จึงจะส่งมอบห้องได้",
  room_occupied: "ผู้เช่าเดิมยังอยู่ในห้อง ส่งมอบได้ตั้งแต่วันถัดจากวันสิ้นสุดสัญญาเดิม",
  not_leaving: "บันทึกย้ายออกได้เมื่อไม่ต่อสัญญา เลิกก่อนกำหนด หรือถึงวันสิ้นสุดแล้ว",
  has_successor: "มีหนังสือต่อสัญญาแล้ว ไม่มีรายการย้ายออก",
};
export const HANDOVER_COMPLETED = "บันทึกส่งมอบลงนามครบแล้ว แก้ไขไม่ได้";
export const HANDOVER_CHANGED = "บันทึกส่งมอบถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนลงนามหรือแก้ไข";

export interface HandoverForm {
  handoverDate: string;
  note: string | null;
  items: Array<Required<Omit<HandoverItemInput, "note" | "moveInItemId">> & { note: string | null; moveInItemId?: number }>;
}

/** D16 (AC-8.4): move-out opens once the stay is ending, and not when a renewal is already linked. */
export function moveOutBlockedReason(input: {
  formKind: string | null;
  status: string;
  endDate: string | null;
  notRenewing: boolean;
  endsOn: boolean;
  hasSuccessor: boolean;
  today: string;
}): Exclude<HandoverBlockedReason, "room_occupied"> | null {
  if (input.formKind !== "lease" && input.formKind !== "renewal") return "not_lease";
  if (input.status === "cancelled") return "contract_ended";
  if (input.hasSuccessor) return "has_successor";
  const ending = input.notRenewing || input.endsOn || (input.endDate != null && input.today >= input.endDate);
  return ending ? null : "not_leaving";
}

const record = (input: unknown) =>
  input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function handoverRevision(input: unknown): number {
  const value = record(input).revision;
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new BadRequestException("ข้อมูลบันทึกส่งมอบไม่ถูกต้อง กรุณาเปิดใหม่");
  return value as number;
}

/** D6: the form the agent saves. Annex 1 items: name, quantity 1–999, condition; damaged or missing needs a note. */
export function validateHandover(input: unknown): HandoverForm {
  const b = record(input);
  const handoverDate = text(b.handoverDate);
  if (!isIsoDate(handoverDate)) throw new BadRequestException("กรุณาระบุวันส่งมอบ (YYYY-MM-DD)");
  if (b.note != null && typeof b.note !== "string") throw new BadRequestException("หมายเหตุไม่ถูกต้อง");
  const note = text(b.note) || null;
  if (note && note.length > 1000) throw new BadRequestException("หมายเหตุยาวเกิน 1,000 ตัวอักษร");
  if (!Array.isArray(b.items)) throw new BadRequestException("รายการทรัพย์สินไม่ถูกต้อง");
  if (b.items.length > HANDOVER_MAX_ITEMS)
    throw new BadRequestException(`รายการทรัพย์สินได้ไม่เกิน ${HANDOVER_MAX_ITEMS} รายการ`);
  const items = b.items.map((raw, index) => {
    const row = record(raw);
    const label = `รายการที่ ${index + 1}`;
    const name = text(row.name);
    if (!name || name.length > 120) throw new BadRequestException(`${label}: กรุณาระบุชื่อ ไม่เกิน 120 ตัวอักษร`);
    const quantity = row.quantity;
    if (!Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 999)
      throw new BadRequestException(`${label}: จำนวนต้องเป็น 1 ถึง 999`);
    const condition = row.condition as HandoverItemCondition;
    if (!CONDITIONS.includes(condition)) throw new BadRequestException(`${label}: กรุณาเลือกสภาพ`);
    if (row.note != null && typeof row.note !== "string") throw new BadRequestException(`${label}: หมายเหตุไม่ถูกต้อง`);
    const itemNote = text(row.note) || null;
    if (itemNote && itemNote.length > 500) throw new BadRequestException(`${label}: หมายเหตุยาวเกิน 500 ตัวอักษร`);
    if (condition !== "good" && !itemNote)
      throw new BadRequestException(`${label}: ของที่ชำรุดหรือไม่มี ต้องระบุหมายเหตุ`);
    const linked = row.moveInItemId;
    if (linked != null && (!Number.isSafeInteger(linked) || (linked as number) < 1))
      throw new BadRequestException(`${label}: รายการเทียบกับตอนเข้าอยู่ไม่ถูกต้อง`);
    return {
      name, quantity: quantity as number, condition, note: itemNote,
      ...(Number.isSafeInteger(linked) ? { moveInItemId: linked as number } : {}),
    };
  });
  return { handoverDate, note, items };
}

/** Same content: saving it again changes nothing, so the signatures stay. */
export function sameHandoverContent(saved: HandoverRecordEntity, items: HandoverItemEntity[], form: HandoverForm) {
  const current = {
    handoverDate: saved.handover_date ? String(saved.handover_date).slice(0, 10) : null,
    note: saved.note ?? null,
    items: [...items]
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((item) => ({ name: item.name, quantity: item.quantity, condition: item.condition, note: item.note ?? null })),
  };
  return JSON.stringify(current) === JSON.stringify(form);
}

function signParty(input: unknown): HandoverSignParty {
  const party = record(input).party;
  if (!HANDOVER_SIGN_PARTIES.includes(party as HandoverSignParty))
    throw new BadRequestException("บันทึกส่งมอบลงนามได้เฉพาะผู้ให้เช่าและผู้เช่า");
  return party as HandoverSignParty;
}

function signaturePng(input: unknown): Buffer {
  const raw = text(record(input).signaturePng).replace(/^data:image\/png;base64,/i, "");
  if (!raw) throw new BadRequestException("กรุณาวาดลายเซ็นก่อนยืนยัน");
  const png = Buffer.from(raw, "base64");
  if (!png.length) throw new BadRequestException("กรุณาวาดลายเซ็นก่อนยืนยัน");
  return png;
}

/**
 * D6 (AC-6.1 to 6.4): handing the room over after the deposit receipt. The agent fills in annex 1 (items) and
 * annex 2 (photos); the landlord and the tenant sign, in their own app or on the agent's device. Any change after a
 * signature voids the signatures (they sign the new content again); once both have signed, the record is locked.
 * D7: once both have signed, a lease waiting for its handover becomes active in the same transaction.
 */
@Injectable()
export class HandoverService {
  constructor(
    private readonly db: DataSource,
    private readonly contracts: AgentContractsService,
    @Optional() private readonly documents?: ContractDocumentStorageService,
  ) {}

  private storage() {
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา");
    return this.documents;
  }

  private findRecord(contractId: number, manager?: EntityManager, kind: HandoverKind = "move_in") {
    return (manager ?? this.db).getRepository(HandoverRecordEntity).findOne({
      where: { agreement_id: contractId, kind },
    });
  }

  private async view(c: LeaseContractEntity, myParties?: HandoverSignParty[], kind: HandoverKind = "move_in"): Promise<HandoverRecord> {
    const blockedReason = await this.blocked(c, undefined, kind);
    const saved = await this.findRecord(c.id, undefined, kind);
    const [items, photos, signatures] = saved
      ? await Promise.all([
          this.db.getRepository(HandoverItemEntity).find({
            where: { handover_record_id: saved.id },
            order: { sort_order: "ASC", id: "ASC" },
          }),
          this.db.getRepository(HandoverPhotoEntity).find({
            where: { handover_record_id: saved.id },
            order: { id: "ASC" },
          }),
          this.db.getRepository(AgreementSignatureEntity).find({
            where: { handover_record_id: saved.id, voided_at: IsNull() },
            relations: { signed_by: true },
            order: { signed_at: "ASC", id: "ASC" },
          }),
        ])
      : [kind === "move_out" && !blockedReason ? await this.sourceMoveInItems(c) : [], [], []];
    const urls = photos.length && this.documents
      ? await this.documents.signPaths(photos.map((photo) => photo.storage_path))
      : new Map<string, string>();
    return {
      contractId: c.id,
      id: saved?.id ?? null,
      status: saved?.completed_at ? "completed" : blockedReason ? "blocked" : saved ? "in_progress" : "not_started",
      blockedReason,
      handoverDate: saved?.handover_date ? String(saved.handover_date).slice(0, 10) : null,
      note: saved?.note ?? null,
      revision: saved?.revision ?? 0,
      items: items.map((item) => ({
        id: item.id, name: item.name, quantity: item.quantity, condition: item.condition, note: item.note,
        ...((item.move_in_item_id ?? (!saved ? item.id : null)) ? { moveInItemId: item.move_in_item_id ?? item.id } : {}),
      })),
      photos: photos.map((photo) => ({
        id: photo.id,
        url: urls.get(photo.storage_path) ?? null,
        caption: photo.caption,
        createdAt: photo.created_at.toISOString(),
      })),
      signatures: signatures.map((row) => ({
        party: row.party as HandoverSignParty,
        channel: row.channel as "app" | "on_site",
        signedAt: row.signed_at.toISOString(),
        // On the agent's device the agent pressed sign for that party: no account name to show.
        signedBy:
          row.channel === "app"
            ? [row.signed_by?.first_name, row.signed_by?.last_name].filter((part) => part?.trim()).join(" ").trim() || null
            : null,
      })),
      completedAt: saved?.completed_at ? saved.completed_at.toISOString() : null,
      ...(myParties ? { myParties } : {}),
    };
  }

  /**
   * Locks the lease (then the record, the order every write here uses), checks nothing changed since `c` was read and
   * that the handover is still open, and returns the record (null if none yet) for `write`.
   */
  private async blocked(c: LeaseContractEntity, manager: EntityManager | undefined, kind: HandoverKind) {
    if (kind === "move_in") return this.contracts.handoverBlockedReason(c, manager);
    const rows = await (manager ?? this.db).getRepository(LeaseContractEntity).find({
      where: { previous_agreement_id: c.id },
      select: { id: true, status: true },
    });
    const data = c.data as { notRenewing?: unknown; endsOn?: unknown } | null;
    return moveOutBlockedReason({
      formKind: c.template?.form_kind ?? c.agreement_type?.form_kind ?? null,
      status: c.status,
      endDate: c.end_date ? String(c.end_date).slice(0, 10) : null,
      notRenewing: Boolean(data?.notRenewing),
      endsOn: Boolean(data?.endsOn),
      hasSuccessor: rows.some((row) => row.status !== "cancelled"),
      today: bangkokToday(),
    });
  }

  /** The completed move-in list this move-out compares with, walking back through renewals. */
  private async sourceMoveInItems(c: LeaseContractEntity): Promise<HandoverItemEntity[]> {
    let id: number | null = c.id;
    const seen = new Set<number>();
    while (id != null && !seen.has(id)) {
      seen.add(id);
      const record = await this.db.getRepository(HandoverRecordEntity).findOne({
        where: { agreement_id: id, kind: "move_in", completed_at: Not(IsNull()) },
      });
      if (record)
        return this.db.getRepository(HandoverItemEntity).find({
          where: { handover_record_id: record.id },
          order: { sort_order: "ASC", id: "ASC" },
        });
      const row: Pick<LeaseContractEntity, "previous_agreement_id"> | null = id === c.id
        ? c
        : await this.db.getRepository(LeaseContractEntity).findOne({ where: { id }, select: { id: true, previous_agreement_id: true } });
      id = row?.previous_agreement_id ?? null;
    }
    return [];
  }

  private async locked<T>(
    c: LeaseContractEntity,
    write: (manager: EntityManager, saved: HandoverRecordEntity | null) => Promise<T>,
    kind: HandoverKind = "move_in",
  ) {
    return this.db.transaction(async (manager) => {
      const lease = await manager.findOne(LeaseContractEntity, { where: { id: c.id }, lock: { mode: "pessimistic_write" } });
      if (!lease || lease.status !== c.status || lease.document_url !== c.document_url)
        throw new ConflictException("สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่");
      const reason = await this.blocked(c, manager, kind);
      if (reason) throw new BadRequestException({ code: "HANDOVER_BLOCKED", reason, message: HANDOVER_BLOCKED_MESSAGES[reason] });
      const saved = await manager.findOne(HandoverRecordEntity, {
        where: { agreement_id: c.id, kind },
        lock: { mode: "pessimistic_write" },
      });
      if (saved?.completed_at) throw new BadRequestException({ code: "HANDOVER_COMPLETED", message: HANDOVER_COMPLETED });
      return write(manager, saved);
    });
  }

  /** A change to the content: next revision, and the signatures made on the old content are void. */
  private async changed(manager: EntityManager, saved: HandoverRecordEntity) {
    await manager.update(HandoverRecordEntity, { id: saved.id }, { revision: saved.revision + 1, updated_at: new Date() });
    await manager.update(
      AgreementSignatureEntity,
      { handover_record_id: saved.id, voided_at: IsNull() },
      { voided_at: new Date() },
    );
  }

  private async create(manager: EntityManager, c: LeaseContractEntity, agentId: number, kind: HandoverKind) {
    return manager.save(
      HandoverRecordEntity,
      manager.create(HandoverRecordEntity, { agreement_id: c.id, kind, created_by_user_id: agentId, revision: 1 }),
    );
  }

  async agentView(agentId: number, id: number, kind: HandoverKind = "move_in") {
    return this.view(await this.contracts.contractForAgent(agentId, id), undefined, kind);
  }

  async save(agentId: number, id: number, input: unknown, kind: HandoverKind = "move_in") {
    const form = validateHandover(input);
    const revision = handoverRevision(input);
    const c = await this.contracts.contractForAgent(agentId, id);
    try {
      await this.locked(c, async (manager, saved) => {
        if ((saved?.revision ?? 0) !== revision) throw new ConflictException(HANDOVER_CHANGED);
        if (saved) {
          const items = await manager.find(HandoverItemEntity, { where: { handover_record_id: saved.id } });
          if (sameHandoverContent(saved, items, form)) return;
        }
        const links = kind === "move_out" ? new Set((await this.sourceMoveInItems(c)).map((item) => item.id)) : null;
        if (links && form.items.some((item) => item.moveInItemId != null && !links.has(item.moveInItemId)))
          throw new BadRequestException("รายการเทียบกับตอนเข้าอยู่ไม่ถูกต้อง");
        const target = saved ?? (await this.create(manager, c, agentId, kind));
        await manager.update(HandoverRecordEntity, { id: target.id }, { handover_date: form.handoverDate, note: form.note });
        await manager.delete(HandoverItemEntity, { handover_record_id: target.id });
        if (form.items.length)
          await manager.insert(
            HandoverItemEntity,
            form.items.map((item, index) => ({
              name: item.name, quantity: item.quantity, condition: item.condition, note: item.note,
              move_in_item_id: kind === "move_out" ? item.moveInItemId ?? null : null,
              handover_record_id: target.id, sort_order: index,
            })),
          );
        if (saved) await this.changed(manager, saved);
      }, kind);
    } catch (error) {
      // Two first saves at once: the unique index lets one through.
      if ((error as { code?: string }).code === "23505") throw new ConflictException(HANDOVER_CHANGED);
      throw error;
    }
    return this.view(c, undefined, kind);
  }

  async addPhoto(agentId: number, id: number, file: { buffer: Buffer; size: number } | undefined, input?: unknown, kind: HandoverKind = "move_in") {
    const caption = text(record(input).caption) || null;
    if (caption && caption.length > 200) throw new BadRequestException("คำอธิบายรูปยาวเกิน 200 ตัวอักษร");
    const c = await this.contracts.contractForAgent(agentId, id);
    // Refused before the upload, so nothing is stored for a closed or blocked handover.
    const reason = await this.blocked(c, undefined, kind);
    if (reason) throw new BadRequestException({ code: "HANDOVER_BLOCKED", reason, message: HANDOVER_BLOCKED_MESSAGES[reason] });
    const storage = this.storage();
    const stored = await storage.uploadHandoverPhoto(c.created_by_user_id, c.id, file);
    try {
      await this.locked(c, async (manager, saved) => {
        const target = saved ?? (await this.create(manager, c, agentId, kind));
        const count = await manager.count(HandoverPhotoEntity, { where: { handover_record_id: target.id } });
        if (count >= HANDOVER_MAX_PHOTOS)
          throw new BadRequestException(`รูปสภาพห้องได้ไม่เกิน ${HANDOVER_MAX_PHOTOS} รูป`);
        await manager.insert(HandoverPhotoEntity, {
          handover_record_id: target.id,
          storage_path: stored.path,
          caption,
          uploaded_by_user_id: agentId,
        });
        if (saved) await this.changed(manager, saved);
      }, kind);
    } catch (error) {
      await storage.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23505") throw new ConflictException(HANDOVER_CHANGED);
      throw error;
    }
    return this.view(c, undefined, kind);
  }

  async removePhoto(agentId: number, id: number, photoId: number, kind: HandoverKind = "move_in") {
    const c = await this.contracts.contractForAgent(agentId, id);
    const removed = await this.locked(c, async (manager, saved) => {
      const photo = saved
        ? await manager.findOne(HandoverPhotoEntity, { where: { id: photoId, handover_record_id: saved.id } })
        : null;
      if (!saved || !photo) throw new NotFoundException("ไม่พบรูป");
      await manager.delete(HandoverPhotoEntity, { id: photo.id });
      await this.changed(manager, saved);
      return photo.storage_path;
    }, kind);
    // The row is gone; a file left behind is only a storage leak, not a visible photo.
    if (this.documents) await this.documents.remove(removed).catch(() => undefined);
    return this.view(c, undefined, kind);
  }

  /** The landlord or the tenant signs on the agent's device at the room (logged as on_site, pressed by the agent). */
  async signOnSite(agentId: number, id: number, input: unknown) {
    const c = await this.contracts.contractForAgent(agentId, id);
    await this.sign(c, signParty(input), input, { channel: "on_site", userId: agentId }, "move_in");
    return this.view(c);
  }

  async partyView(userId: number, id: number, kind: HandoverKind = "move_in") {
    const { contract, parties } = await this.contracts.contractForParty(userId, id);
    return this.view(contract, handoverParties(parties), kind);
  }

  /** The landlord or the tenant signs in their own app, only for their own side. */
  async partySign(userId: number, id: number, input: unknown, kind: HandoverKind = "move_in") {
    const { contract, parties } = await this.contracts.contractForParty(userId, id);
    const party = signParty(input);
    const mine = handoverParties(parties);
    if (!mine.includes(party)) throw new ForbiddenException("ลงนามได้เฉพาะฝ่ายของคุณ");
    await this.sign(contract, party, input, { channel: "app", userId }, kind);
    return this.view(contract, mine, kind);
  }

  private async sign(
    c: LeaseContractEntity,
    party: HandoverSignParty,
    input: unknown,
    by: { channel: "app" | "on_site"; userId: number },
    kind: HandoverKind = "move_in",
  ) {
    if (kind === "move_out" && by.channel === "on_site")
      throw new ForbiddenException("ช่องย้ายออกให้ผู้ให้เช่าและผู้เช่าลงนามเอง");
    const revision = handoverRevision(input);
    const png = signaturePng(input);
    // Refused before the upload when the handover is not open.
    const reason = await this.blocked(c, undefined, kind);
    if (reason) throw new BadRequestException({ code: "HANDOVER_BLOCKED", reason, message: HANDOVER_BLOCKED_MESSAGES[reason] });
    const storage = this.storage();
    const stored = await storage.uploadSignature(c.created_by_user_id, c.id, { buffer: png, size: png.length });
    try {
      await this.locked(c, async (manager, saved) => {
        if (!saved) throw new BadRequestException("ยังไม่มีบันทึกส่งมอบให้ลงนาม");
        if (saved.revision !== revision) throw new ConflictException(HANDOVER_CHANGED);
        if (!saved.handover_date) throw new BadRequestException("กรุณาระบุวันส่งมอบก่อนลงนาม");
        if (!(await manager.count(HandoverPhotoEntity, { where: { handover_record_id: saved.id } })))
          throw new BadRequestException("ต้องมีรูปสภาพห้องอย่างน้อย 1 รูปก่อนลงนาม");
        const live = await manager.find(AgreementSignatureEntity, {
          where: { handover_record_id: saved.id, voided_at: IsNull() },
        });
        if (live.some((row) => row.party === party)) throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
        const now = new Date();
        await manager.insert(AgreementSignatureEntity, {
          agreement_id: c.id,
          handover_record_id: saved.id,
          party,
          channel: by.channel,
          signed_by_user_id: by.userId,
          signature_url: stored.path,
          signed_at: now,
        });
        const signed = new Set([...live.map((row) => row.party), party]);
        if (HANDOVER_SIGN_PARTIES.every((side) => signed.has(side))) {
          await manager.update(HandoverRecordEntity, { id: saved.id, completed_at: IsNull() }, { completed_at: now });
          // D7 (AC-6.3): moving in makes a lease that is waiting for handover active. Moving out does not.
          if (kind === "move_in")
            await manager.update(LeaseContractEntity, { id: c.id, status: "awaiting_handover" }, { status: "active" });
        }
      }, kind);
    } catch (error) {
      await storage.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23505") throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
      throw error;
    }
  }
}

function handoverParties(parties: ContractParty[]): HandoverSignParty[] {
  return HANDOVER_SIGN_PARTIES.filter((party) => parties.includes(party));
}
