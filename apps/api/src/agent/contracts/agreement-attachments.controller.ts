import { DatabaseIdPipe } from '../../common/database-id.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AgreementAttachmentsService } from "./agreement-attachments.service";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "./contract-document-storage.service";
@Controller("agent/contracts/:id/attachments")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgreementAttachmentsController {
  constructor(private readonly attachments: AgreementAttachmentsService) {}
  @Get() list(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.attachments.list(user.id, id);
  }
  @Get(":documentId/url") url(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("documentId", DatabaseIdPipe) documentId: number,
  ) {
    return this.attachments.url(user.id, id, documentId);
  }
  @Post()
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
  upload(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() input: unknown,
    @UploadedFile()
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.attachments.upload(user.id, id, input, file);
  }
  @Delete(":documentId") remove(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("documentId", DatabaseIdPipe) documentId: number,
  ) {
    return this.attachments.remove(user.id, id, documentId);
  }
  @Post(":documentId/review") review(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("documentId", DatabaseIdPipe) documentId: number,
    @Body() input: unknown,
  ) {
    return this.attachments.review(user.id, id, documentId, input);
  }
  @Post("reuse") reuse(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() input: unknown,
  ) {
    return this.attachments.reuse(user.id, id, input);
  }
}
