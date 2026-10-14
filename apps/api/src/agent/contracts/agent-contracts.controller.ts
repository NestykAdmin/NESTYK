import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../../auth/decorators/current-user.decorator";
import { AgentContractsService } from "./agent-contracts.service";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "./contract-document-storage.service";

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
  constructor(private readonly contracts: AgentContractsService) {}
  @Get("types") types() {
    return this.contracts.types();
  }
  @Get("types/:code/templates") templates(@Param("code") code: string) {
    return this.contracts.templates(code);
  }
  @Get(":id/history") history(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.history(user.id, id);
  }
  @Get("candidates") candidates(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.candidates(user.id);
  }
  @Get("owner-users")
  ownerUsers(@Query("q") q?: string) {
    return this.contracts.searchOwnerUsers(q ?? "");
  }
  @Get("reservation-defaults/:leadId") reservationDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", ParseIntPipe) leadId: number,
  ) {
    return this.contracts.reservationDefaults(user.id, leadId);
  }
  @Get("broker-appointment-defaults/:leadId") brokerAppointmentDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", ParseIntPipe) leadId: number,
  ) {
    return this.contracts.brokerAppointmentDefaults(user.id, leadId);
  }
  @Get("lease-defaults/:leadId") leaseDefaults(
    @CurrentUser() user: AuthRequestUser,
    @Param("leadId", ParseIntPipe) leadId: number,
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
    @Param("invoiceId", ParseIntPipe) invoiceId: number,
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
    @Param("invoiceId", ParseIntPipe) invoiceId: number,
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
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.view(user.id, id);
  }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.contracts.create(user.id, body);
  }
  @Get(":id/draft-template")
  draftTemplate(@CurrentUser() user: AuthRequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.contracts.draftTemplate(user.id, id);
  }
  @Post(":id/draft")
  @HttpCode(HttpStatus.OK)
  updateDraft(@CurrentUser() user: AuthRequestUser, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    return this.contracts.updateDraft(user.id, id, body);
  }
  @Post(":id/cancel-draft")
  @HttpCode(HttpStatus.OK)
  cancelDraft(@CurrentUser() user: AuthRequestUser, @Param("id", ParseIntPipe) id: number, @Body() body: unknown) {
    return this.contracts.cancelDraft(user.id, id, body);
  }
  @Post(":id/reservation-preview")
  @HttpCode(HttpStatus.OK)
  reservationPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, false);
  }
  @Post(":id/generate-reservation")
  @HttpCode(HttpStatus.OK)
  generateReservation(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, true);
  }
  @Post(":id/broker-appointment-preview")
  @HttpCode(HttpStatus.OK)
  brokerAppointmentPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.brokerAppointmentPdf(user.id, id, false);
  }
  @Post(":id/generate-broker-appointment")
  @HttpCode(HttpStatus.OK)
  generateBrokerAppointment(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.brokerAppointmentPdf(user.id, id, true);
  }
  @Post(":id/lease-renewal-preview")
  @HttpCode(HttpStatus.OK)
  leaseRenewalPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.leaseRenewalPdf(user.id, id, false);
  }
  @Post(":id/generate-lease-renewal")
  @HttpCode(HttpStatus.OK)
  generateLeaseRenewal(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.leaseRenewalPdf(user.id, id, true);
  }
  @Post(":id/lease-preview")
  @HttpCode(HttpStatus.OK)
  leasePreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.leaseAgreementPdf(user.id, id, false);
  }
  @Post(":id/generate-lease")
  @HttpCode(HttpStatus.OK)
  generateLease(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.leaseAgreementPdf(user.id, id, true);
  }
  @Post(":id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.sign(user.id, id, body);
  }
  @Post(":id/deliveries")
  @HttpCode(HttpStatus.OK)
  deliver(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.deliverToParty(user.id, id, body);
  }
  @Post(":id/sign-invites")
  @HttpCode(HttpStatus.OK)
  createSignInvite(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.createSignInvite(user.id, id, body);
  }
  @Get(":id/financial-documents/:kind")
  financialDefaults(@CurrentUser() user: AuthRequestUser, @Param("id", ParseIntPipe) id: number, @Param("kind") kind: string) {
    return this.contracts.financialDocumentDefaults(user.id, id, kind);
  }
  @Post(":id/financial-documents/:kind")
  @HttpCode(HttpStatus.OK)
  generateFinancial(@CurrentUser() user: AuthRequestUser, @Param("id", ParseIntPipe) id: number, @Param("kind") kind: string, @Body() body: unknown) {
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
    @Param("id", ParseIntPipe) id: number,
    @Param("kind") kind: string,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadDocument(user.id, id, kind, file);
  }
}
