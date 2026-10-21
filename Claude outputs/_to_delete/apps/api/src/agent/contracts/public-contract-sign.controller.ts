import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { AgentContractsService } from "./agent-contracts.service";

@Controller("public/contract-sign")
export class PublicContractSignController {
  constructor(private readonly contracts: AgentContractsService) {}

  @Get(":token")
  preview(@Param("token") token: string) {
    return this.contracts.publicSignPreview(token);
  }

  @Post(":token")
  @HttpCode(HttpStatus.OK)
  sign(@Param("token") token: string, @Body() body: unknown) {
    return this.contracts.publicSign(token, body);
  }
}
