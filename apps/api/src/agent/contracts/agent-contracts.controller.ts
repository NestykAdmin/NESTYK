import { SingleQueryPipe } from '../../common/single-query.pipe';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import {
  BadRequestException,
  ServiceUnavailableException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../../auth/decorators/current-user.decorator";
import { AgentContractsService } from "./agent-contracts.service";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "./contract-document-storage.service";
import { MAX_EVIDENCE_FILES } from "./deal-cancellation";
import { HandoverService } from "./handover.service";
import { DepositSettlementService } from "./deposit-settlement";

function receiptPayload(body: unknown): unknown {
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { payload?: unknown }).payload === "string"
  ) {
    try {
      return JSON.parse((body as { payload: string }).payload) as unknown;
    } catch {
      throw new BadRequestException("ข้อมูลไม่ถูกต้อง");
    }
  }
  return body;
}

@Controller("agent/contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgentContractsController {
  constructor(
    private readonly contracts: AgentContractsService,
    @Optional() private readonly handover?: HandoverService,
    @Optional() private readonly settlements?: DepositSettlementService,
  ) {}
  private handovers() {
    if (!this.handover) throw new ServiceUnavailableException("ยังไม่เปิดใช้การส่งมอบห้อง");
    return this.handover;
  }
  private settlement() {
    if (!this.settlements) throw new ServiceUnavailableException("ยังไม่เปิดใช้การคืนเงินประกัน");
    return this.settlements;
  }
  @Get("end-reasons")
  endReasons() {
    return this.contracts.endReasons();
  }
  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.contracts.close(user.id, id, body);
  }
  @Get("types") types() {
    return this.contracts.types();
  }
  @Get("types/:code/templates") templates(@Param("code") code: string) {
    return this.contracts.templates(code);
  }
  @Get(":id/history") history(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.history(user.id, id);
  }
  /** D9: the witness of a lease signs on the agent's device (the agent can be the witness). */
  @Post(":id/witness-sign") witnessSign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.witnessSign(user.id, id, body);
  }
  /** D10: issue the deposit invoice of a generated lease again (it is issued when the lease is generated). */
  @Post(":id/deposit-invoice") issueDepositInvoice(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.issueDepositInvoice(user.id, id);
  }
  /** D4 (AC-5.5): move the handover day of a lease waiting for its deposit or handover (body: { date, reason }). */
  @Post(":id/handover-due")
  @HttpCode(HttpStatus.OK)
  moveHandoverDue(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.moveHandoverDue(user.id, id, body);
  }
  /** D16 (AC-7.7): end an active lease early (body: { date, reason }). The date is not before today. */
  @Post(":id/early-end")
  @HttpCode(HttpStatus.OK)
  setEarlyEnd(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.setEarlyEnd(user.id, id, body);
  }
  /** D16 (AC-7.7): the typed refund or the amount to collect after an early ending. Once only. */
  @Post(":id/early-end/money")
  @HttpCode(HttpStatus.OK)
  recordEarlyEndMoney(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.recordEarlyEndMoney(user.id, id, body);
  }
  @Get(":id/early-end/:kind")
  earlyEndFile(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("kind") kind: string,
  ) {
    return this.contracts.earlyEndFileUrl(user.id, id, kind, true);
  }
  /** M5: confirm the money of the tenant's slip (body: { submittedAt } of the slip the agent looked at). */
  @Post(":id/early-end/slip/confirm")
  @HttpCode(HttpStatus.OK)
  confirmEarlyEndSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.confirmEarlyEndSlip(user.id, id, body);
  }
  /** M5: return the tenant's slip with a reason (body: { reason, submittedAt }). */
  @Post(":id/early-end/slip/return")
  @HttpCode(HttpStatus.OK)
  returnEarlyEndSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.returnEarlyEndSlip(user.id, id, body);
  }
  @Post(":id/early-end/refund-proof")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 } }))
  earlyEndProof(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadEarlyEndProof(user.id, id, file);
  }
  /** D15 (AC-8.3): record that the stay will not be renewed, or undo that while nobody else has booked the room. */
  @Post(":id/not-renewing")
  @HttpCode(HttpStatus.OK)
  setNotRenewing(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: { notRenewing?: unknown },
  ) {
    return this.contracts.setNotRenewing(user.id, id, body?.notRenewing !== false);
  }
  /** D11 (AC-3.4): return the tenant's booking slip with a reason (body: { reason }). */
  @Post(":id/reservation-payment/return")
  @HttpCode(HttpStatus.OK)
  returnReservationSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.returnReservationSlip(user.id, id, body);
  }
  /** D11 (AC-5.4): return the tenant's deposit slip of a lease with a reason (body: { reason }). */
  @Post(":id/deposit-payment/return")
  @HttpCode(HttpStatus.OK)
  returnDepositSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.returnDepositSlip(user.id, id, body);
  }
  /** D6: the handover record of a lease (annex 1 items, annex 2 photos, signatures). */
  @Get(":id/handover") handoverView(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.handovers().agentView(user.id, id);
  }
  @Put(":id/handover") handoverSave(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.handovers().save(user.id, id, body);
  }
  @Post(":id/handover/photos")
  @UseInterceptors(FileInterceptor("file", {
    // fieldSize is in bytes: 200 Thai characters of caption are up to 600 bytes.
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 1, fieldSize: 1024 },
  }))
  handoverPhoto(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.handovers().addPhoto(user.id, id, file, body);
  }
  @Delete(":id/handover/photos/:photoId") handoverPhotoRemove(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("photoId", DatabaseIdPipe) photoId: number,
  ) {
    return this.handovers().removePhoto(user.id, id, photoId);
  }
  /** D16 (AC-8.4): the move-out annexes. The parties sign themselves; this does not change the lease status. */
  @Get(":id/handover/move-out") moveOutView(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.handovers().agentView(user.id, id, "move_out");
  }
  @Put(":id/handover/move-out") moveOutSave(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.handovers().save(user.id, id, body, "move_out");
  }
  @Post(":id/handover/move-out/photos")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 1, fieldSize: 1024 },
  }))
  moveOutPhoto(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.handovers().addPhoto(user.id, id, file, body, "move_out");
  }
  @Delete(":id/handover/move-out/photos/:photoId") moveOutPhotoRemove(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("photoId", DatabaseIdPipe) photoId: number,
  ) {
    return this.handovers().removePhoto(user.id, id, photoId, "move_out");
  }
  /** D16 (AC-8.4 to 8.6): the deposit deductions and the one-time refund of one lease. */
  @Get(":id/deposit-settlement") depositView(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.settlement().agentView(user.id, id);
  }
  @Post(":id/deposit-settlement")
  @HttpCode(HttpStatus.OK)
  depositOpen(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.settlement().open(user.id, id);
  }
  @Post(":id/deposit-settlement/items")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 3, fieldSize: 4096 } }))
  depositItem(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.settlement().addItem(user.id, id, body, file);
  }
  @Delete(":id/deposit-settlement/items/:itemId") depositItemRemove(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("itemId", DatabaseIdPipe) itemId: number,
  ) {
    return this.settlement().removeItem(user.id, id, itemId);
  }
  @Post(":id/deposit-settlement/approve")
  @HttpCode(HttpStatus.OK)
  depositApprove(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.settlement().approve(user.id, id, body);
  }
  @Post(":id/deposit-settlement/refund")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileFieldsInterceptor([
    { name: "received", maxCount: 1 },
    { name: "transfer", maxCount: 1 },
  ], { limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 2 } }))
  depositRefund(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFiles() files: { received?: Array<{ buffer: Buffer; size: number }>; transfer?: Array<{ buffer: Buffer; size: number }> },
  ) {
    return this.settlement().complete(user.id, id, files?.received?.[0], files?.transfer?.[0]);
  }
  /** D6: the landlord or the tenant signs the handover on the agent's device. */
  @Post(":id/handover/sign")
  @HttpCode(HttpStatus.OK)
  handoverSign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.handovers().signOnSite(user.id, id, body);
  }
  /** D17: who signed this contract and through which channel. */
  @Get(":id/signatures") signatures(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.signatureLog(user.id, id);
  }
  @Get("candidates") candidates(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.candidates(user.id);
  }
  @Get("owner-users")
  ownerUsers(@Query("q", SingleQueryPipe) q?: string) {
    return this.contracts.searchOwnerUsers(q ?? "");
  }
  @Get("reservation-defaults/:leadId") reservationDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", DatabaseIdPipe) leadId: number,
  ) {
    return this.contracts.reservationDefaults(user.id, leadId);
  }
  @Get("broker-appointment-defaults/:leadId") brokerAppointmentDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", DatabaseIdPipe) leadId: number,
  ) {
    return this.contracts.brokerAppointmentDefaults(user.id, leadId);
  }
  @Get("lease-defaults/:leadId") leaseDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", DatabaseIdPipe) leadId: number,
  ) {
    return this.contracts.leaseDefaults(user.id, leadId);
  }
  @Get() list(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.list(user.id);
  }
  @Get("invoices/next-number")
  nextInvoiceNumber() {
    return this.contracts.peekNextInvoiceNo();
  }
  @Get("invoices")
  listInvoices(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.listStandaloneInvoices(user.id);
  }
  @Post("invoices")
  @HttpCode(HttpStatus.OK)
  createInvoice(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.contracts.createStandaloneInvoice(user.id, body);
  }
  @Get("commission-confirmations/next-number")
  nextCommissionNumber() {
    return this.contracts.peekNextCommissionNo();
  }
  @Get("commission-confirmations")
  listCommissionConfirmations(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.listCommissionConfirmations(user.id);
  }
  @Post("commission-confirmations")
  @HttpCode(HttpStatus.OK)
  createCommissionConfirmation(
    @CurrentUser() user: AuthRequestUser,
    @Body() body: unknown,
  ) {
    return this.contracts.createCommissionConfirmation(user.id, body);
  }
  @Get("invoices/:invoiceId/receipt-defaults")
  receiptDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("invoiceId", DatabaseIdPipe) invoiceId: number,
  ) {
    return this.contracts.receiptDefaults(user.id, invoiceId);
  }
  @Post("invoices/:invoiceId/receipt")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1 },
    }),
  )
  createReceipt(
    @CurrentUser() user: AuthRequestUser,
    @Param("invoiceId", DatabaseIdPipe) invoiceId: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Body() body: unknown,
  ) {
    return this.contracts.createReceiptForInvoice(
      user.id,
      invoiceId,
      receiptPayload(body),
      file,
    );
  }
  @Get(":id") view(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.view(user.id, id);
  }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.contracts.create(user.id, body);
  }
  @Get(":id/draft-template")
  draftTemplate(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number) {
    return this.contracts.draftTemplate(user.id, id);
  }
  @Post(":id/draft")
  @HttpCode(HttpStatus.OK)
  updateDraft(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.contracts.updateDraft(user.id, id, body);
  }
  /** D5 (AC-C.4): what cancelling the deal would close and the money received with a receipt. */
  @Get(":id/cancellation-preview")
  dealCancellationPreview(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number) {
    return this.contracts.dealCancellationPreview(user.id, id);
  }
  /** D5: cancel the deal before the handover (multipart: payload = CancelDeal as JSON, evidence = 1 to 5 files). */
  @Post(":id/cancel-deal")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor("evidence", MAX_EVIDENCE_FILES, {
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: MAX_EVIDENCE_FILES },
  }))
  cancelDeal(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFiles() files: Array<{ buffer: Buffer; size: number; originalname?: string }> | undefined,
    @Body() body: unknown,
  ) {
    return this.contracts.cancelDeal(user.id, id, receiptPayload(body), files);
  }
  /** D5 (AC-C.2, C.3): record the refund (multipart: payload = { refundedOn }, file = the proof). */
  @Post(":id/cancellation/refund")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1 } }))
  recordDealRefund(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
    @Body() body: unknown,
  ) {
    return this.contracts.recordDealRefund(user.id, id, receiptPayload(body), file);
  }
  @Post(":id/cancel-draft")
  @HttpCode(HttpStatus.OK)
  cancelDraft(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.contracts.cancelDraft(user.id, id, body);
  }
  @Post(":id/reservation-preview")
  @HttpCode(HttpStatus.OK)
  reservationPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, false);
  }
  @Post(":id/generate-reservation")
  @HttpCode(HttpStatus.OK)
  generateReservation(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, true);
  }
  @Post(":id/broker-appointment-preview")
  @HttpCode(HttpStatus.OK)
  brokerAppointmentPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.brokerAppointmentPdf(user.id, id, false);
  }
  @Post(":id/generate-broker-appointment")
  @HttpCode(HttpStatus.OK)
  generateBrokerAppointment(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.brokerAppointmentPdf(user.id, id, true);
  }
  @Post(":id/lease-renewal-preview")
  @HttpCode(HttpStatus.OK)
  leaseRenewalPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.leaseRenewalPdf(user.id, id, false);
  }
  @Post(":id/generate-lease-renewal")
  @HttpCode(HttpStatus.OK)
  generateLeaseRenewal(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.leaseRenewalPdf(user.id, id, true);
  }
  @Post(":id/lease-preview")
  @HttpCode(HttpStatus.OK)
  leasePreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.leaseAgreementPdf(user.id, id, false);
  }
  @Post(":id/generate-lease")
  @HttpCode(HttpStatus.OK)
  generateLease(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.leaseAgreementPdf(user.id, id, true);
  }
  @Post(":id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.sign(user.id, id, body);
  }
  @Post(":id/deliveries")
  @HttpCode(HttpStatus.OK)
  deliver(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.deliverToParty(user.id, id, body);
  }
  @Get(":id/financial-documents/:kind")
  financialDefaults(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Param("kind") kind: string) {
    return this.contracts.financialDocumentDefaults(user.id, id, kind);
  }
  @Post(":id/financial-documents/:kind")
  @HttpCode(HttpStatus.OK)
  generateFinancial(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Param("kind") kind: string, @Body() body: unknown) {
    return this.contracts.generateFinancialDocument(user.id, id, kind, body);
  }
  @Post(":id/documents/:kind")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("kind") kind: string,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadDocument(user.id, id, kind, file);
  }
}
