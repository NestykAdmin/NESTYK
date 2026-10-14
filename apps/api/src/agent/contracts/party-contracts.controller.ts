import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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

@Controller("contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant", "owner")
export class PartyContractsController {
  constructor(
    private readonly contracts: AgentContractsService,
    private readonly attachments: AgreementAttachmentsService,
  ) {}

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
    @Param("id", ParseIntPipe) id: number,
  ) {
    const { contract } = await this.contracts.contractForParty(user.id, id);
    return this.attachments.checklistForContract(contract);
  }

  @Get("mine/:id/attachments/:documentId/url")
  async attachmentUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Param("documentId", ParseIntPipe) documentId: number,
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
    @Param("id", ParseIntPipe) id: number,
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
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.documentForParty(user.id, id);
  }

  @Get("mine/:id/financial-documents/:kind")
  financialDocument(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
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
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.contracts.uploadReservationPaymentSlip(user.id, id, file);
  }

  @Post("mine/:id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.signAsParty(user.id, id, body);
  }
}
