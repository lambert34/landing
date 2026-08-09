import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { FaucetModule } from './modules/faucet/faucet.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PricesModule } from './modules/prices/prices.module.js';
import { SwapsModule } from './modules/swaps/swaps.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WalletsModule } from './modules/wallets/wallets.module.js';
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    PricesModule,
    TransactionsModule,
    SwapsModule,
    FaucetModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
