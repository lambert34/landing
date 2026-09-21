import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WalletsController } from './wallets.controller.js';
import { WalletsRepository } from './wallets.repository.js';
import { WalletsService } from './wallets.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WalletsController],
  providers: [WalletsRepository, WalletsService],
})
export class WalletsModule {}
