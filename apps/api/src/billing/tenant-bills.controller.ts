import {
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
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../auth/decorators/current-user.decorator";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "../agent/contracts/contract-document-storage.service";
import { TenantBillingService } from "./tenant-billing.service";

@Controller("bills")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant")
export class TenantBillsController {
  constructor(private readonly billing: TenantBillingService) {}

  @Get("mine")
  mine(@CurrentUser() user: AuthRequestUser) {
    return this.billing.listMine(user.id);
  }

  @Get("mine/next")
  next(@CurrentUser() user: AuthRequestUser) {
    return this.billing.nextForUser(user.id);
  }

  @Get("mine/:id/payment-slip")
  paymentSlipUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.billing.paymentSlipUrl(user.id, id);
  }

  @Post("mine/:id/payment-slip")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 },
  }))
  uploadPaymentSlip(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    return this.billing.uploadPaymentSlip(user.id, id, file);
  }
}
