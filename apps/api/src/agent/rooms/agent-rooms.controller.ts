import { SingleQueryPipe } from '../../common/single-query.pipe';
import { contactPageOptions } from '../contacts/contact-pagination';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_ROOM_PHOTO_BYTES, RoomPhotoStorageService } from './room-photo-storage.service';
import {
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentRoomsService } from './agent-rooms.service';
import { ListingPromoService } from './listing-promo.service';
import { CreateRoomBody } from './dto/create-room.dto';
import { GenerateListingPromoBody } from './dto/generate-listing-promo.dto';

@Controller('agent/rooms')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentRoomsController {
  constructor(
    private readonly roomsService: AgentRoomsService,
    private readonly photos: RoomPhotoStorageService,
    private readonly listingPromo: ListingPromoService,
  ) {}

  @Get('properties')
  listProperties(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listProperties(user.id);
  }

  @Get('property-types')
  listPropertyTypes() {
    return this.roomsService.listPropertyTypes();
  }

  @Get('contract-types')
  listContractTypes() {
    return this.roomsService.listContractTypes();
  }

  @Get('room-types')
  listRoomTypes() {
    return this.roomsService.listRoomTypes();
  }

  @Get('facilities')
  listFacilities() {
    return this.roomsService.listFacilities();
  }

  @Get('contacts')
  listContacts(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listContacts(user.id);
  }

  @Get('contacts/:id')
  getContact(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number) {
    return this.roomsService.getContact(user.id, id);
  }

  @Get('contacts/:id/rooms')
  listContactRooms(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number) {
    return this.roomsService.listContactRooms(user.id, id);
  }

  @Patch('contacts/:id')
  updateContact(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number,
    @Body() body: unknown) {
    return this.roomsService.updateContact(user.id, id, body);
  }

  @Get('co-agent-contacts')
  listCoAgentContacts(@CurrentUser() user: AuthRequestUser, @Query(new SingleQueryPipe()) query: Record<string, unknown>) {
    return this.roomsService.listCoAgentContacts(user.id, contactPageOptions(query));
  }

  @Post('co-agent-contacts')
  createCoAgentContact(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.roomsService.createCoAgentContact(user.id, body);
  }

  @Get('owner-contacts')
  listOwnerContacts(@CurrentUser() user: AuthRequestUser, @Query(new SingleQueryPipe()) query: Record<string, unknown>) {
    return this.roomsService.listOwnerContacts(user.id, contactPageOptions(query));
  }

  @Get('landlord-contacts')
  listLandlordContacts(@CurrentUser() user: AuthRequestUser, @Query(new SingleQueryPipe()) query: Record<string, unknown>) {
    return this.roomsService.listLandlordContacts(user.id, contactPageOptions(query));
  }

  @Get('property-owners')
  listPropertyOwners(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listPropertyOwners(user.id);
  }

  @Post('media/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ROOM_PHOTO_BYTES, files: 1, fields: 0 } }))
  uploadMedia(@CurrentUser() user: AuthRequestUser,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Req() request: { protocol: string; get(name: string): string }) {
    return this.photos.upload(user.id, file, `${request.protocol}://${request.get('host')}`);
  }

  @Post('media/enhance')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ROOM_PHOTO_BYTES, files: 1, fields: 0 } }))
  enhanceMedia(@CurrentUser() user: AuthRequestUser,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Req() request: { protocol: string; get(name: string): string }) {
    return this.photos.enhance(user.id, file, `${request.protocol}://${request.get('host')}`);
  }

  @Post('generate-listing-promo')
  @HttpCode(HttpStatus.OK)
  generateListingPromo(@Body() body: GenerateListingPromoBody) {
    return this.listingPromo.generate(body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number,
    @Body() body: CreateRoomBody, @Req() request: { protocol: string; get(name: string): string }) {
    return this.roomsService.createScoutRoom(user, body, `${request.protocol}://${request.get('host')}`, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthRequestUser, @Body() body: CreateRoomBody,
    @Req() request: { protocol: string; get(name: string): string }) {
    return this.roomsService.createScoutRoom(user, body, `${request.protocol}://${request.get('host')}`);
  }
}
