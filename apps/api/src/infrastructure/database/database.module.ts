import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { createDatabase } from '@g64/database';
import { loadConfig } from '@g64/config';

export const DATABASE = Symbol('DATABASE');
export type Database = ReturnType<typeof createDatabase>;
@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: Database) {}
  async onApplicationShutdown(): Promise<void> {
    await this.database.close();
  }
}
@Global()
@Module({
  providers: [
    { provide: DATABASE, useFactory: () => createDatabase(loadConfig().DATABASE_URL) },
    DatabaseLifecycle,
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
