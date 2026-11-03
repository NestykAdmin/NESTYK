import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { MasterRoleEntity } from '../entities/master-role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ProfileAvatarStorage } from './profile-avatar-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, MasterRoleEntity, UserRoleEntity])],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, ProfileAvatarStorage],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
