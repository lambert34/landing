import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type {
  AuthUser,
  EvmWalletResponse,
  WalletRegistrationChallengeResponse,
  WalletRegistrationResponse,
} from '@g64/types';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { OriginGuard } from '../auth/origin.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { WalletError } from './wallet.error.js';
import { parseWalletChallengeInput, parseWalletRegisterInput } from './wallet.schemas.js';
import { WalletsService } from './wallets.service.js';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get('evm')
  @UseGuards(SessionGuard)
  evmWallet(@CurrentUser() user: AuthUser): Promise<EvmWalletResponse> {
    return this.wallets.evmWallet(user.id);
  }

  @Post('evm/registration-challenge')
  @UseGuards(OriginGuard, SessionGuard)
  createChallenge(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<WalletRegistrationChallengeResponse> {
    const parsed = parseWalletChallengeInput(body);
    if (!parsed) throw new WalletError('INVALID_REQUEST', 400);
    return this.wallets.createRegistrationChallenge(user.id, parsed.address);
  }

  @Post('evm/register')
  @UseGuards(OriginGuard, SessionGuard)
  register(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<WalletRegistrationResponse> {
    const parsed = parseWalletRegisterInput(body);
    if (!parsed) throw new WalletError('INVALID_REQUEST', 400);
    return this.wallets.register(user.id, parsed.challengeId, parsed.signature);
  }
}
