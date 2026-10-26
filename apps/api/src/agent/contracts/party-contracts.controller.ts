import { DatabaseIdPipe } from '../../common/database-id.pipe';
import {
  ServiceUnavailableException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
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
import { AgreementAttachmentsService } from "./agreement-attachments.service";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "./contract-document-storage.service";
import { HandoverService } from "./handover.service";
import { DealOffersService } from "./deal-offers.service";

@Controller("contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant", "landlord")
export class PartyContractsController {
  constructor(
    private readonly contracts: AgentContractsService,
    private readonly attachments: AgreementAttachmentsService,
    @Optional() private readonly handover?: HandoverService,
    @Optional() private readonly offers?: DealOffersService,
  ) {}
  private handovers() {
    if (!this.handover) throw new ServiceUnavailableException("ยังไม่เปิดใช้การส่งมอบห้อง");
    return this.handover;
  }

  /** D6: the handover record of the lease (the landlord and the tenant review it, then sign). */
  @Get("mine/:id/handover")
  handoverView(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.handovers().partyView(user.id, id);
  }

  @Post("mine/:id/handover/sign")
  @HttpCode(HttpStatus.OK)
  handoverSign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.handovers().partySign(user.id, id, body);
  }

  private dealOffers() {
    if (!this.offers) throw new ServiceUnavailableException("ยังไม่เปิดใช้ข้อเสนอ");
    return this.offers;
  }

  /** D2: offers on the landlord's rooms, to confirm (awaiting_landlord) or already confirmed. */
  @Get("mine/deal-offers")
  @Roles("landlord")
  landlordOffers(@CurrentUser() user: AuthRequestUser) {
    return this.dealOffers().listForLandlord(user.id);
  }

  @Post("mine/deal-offers/:id/confirm")
  @Roles("landlord")
  @HttpCode(HttpStatus.OK)
  landlordConfirm(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.dealOffers().confirmAsLandlord(user.id, id, body);
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.listForUser(user.id);
  }

  @Get("mine/rooms")
  ownedRooms(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.listOwnedRooms(user.id);
  }

  @Get("mine/:id/attachments")
  async listAttachments(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    const { contract } = await this.contracts.contractForParty(user.id, id);
    return this.attachments.checklistForContract(contract);
  }

  @Get("mine/:id/attachments/:documentId/url")
  async attachmentUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("documentId", DatabaseIdPipe) documentId: number,
  ) {
    const { contract } = await this.contracts.contractForParty(user.id, id);
    return this.attachments.urlForContract(contract, documentId);
  }

  @Post("mine/:id/attachments")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: MAX_CONTRACT_DOCUMENT_BYTES,
        files: 1,
        fields: 3,
        fieldSize: 256,
      },
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() input: unknown,
    @UploadedFile()
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    const { contract, parties } = await this.contracts.contractForParty(
      user.id,
      id,
    );
    return this.attachments.uploadForParty(
      contract,
      user.id,
      parties,
      input,
      file,
    );
  }

  @Post("mine/:id/document")
  @HttpCode(HttpStatus.OK)
  document(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.contracts.documentForParty(user.id, id);
  }

  @Get("mine/:id/financial-documents/:kind")
  financialDocument(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("kind") kind: string,
  ) {
    return this.contracts.financialDocumentForParty(user.id, id, kind);
  }

  @Post("mine/:id/payment-slip")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 },
  }))
  paymentSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadReservationPaymentSlip(user.id, id, file);
  }

  /** D10: the tenant sends the slip for the deposit invoice of a generated lease. */
  @Post("mine/:id/deposit-payment-slip")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 },
  }))
  depositPaymentSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadDepositPaymentSlip(user.id, id, file);
  }

  @Post("mine/:id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.signAsParty(user.id, id, body);
  }
}
