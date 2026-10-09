import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { SchemaDriftCheck } from './schema-drift.check';

const logger = new Logger('DatabaseModule');

function buildTypeOrmOptions() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  const dbSchema = process.env.DB_SCHEMA ?? 'public';
  const isLocalhost =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

  return {
    type: 'postgres' as const,
    url: databaseUrl,
    schema: dbSchema,
    entities: ALL_ENTITIES,
    synchronize: false,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    // Opt-in only — default off so turbo/dev terminals stay readable.
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}

const typeOrmRoot = (() => {
  const options = buildTypeOrmOptions();
  if (!options) {
    logger.warn(
      'DATABASE_URL is not provided. Skipping Database Connection for Mock/Skeleton mode.',
    );
    return [];
  }
  return [TypeOrmModule.forRoot(options)];
})();

@Module({
  imports: [...typeOrmRoot, TypeOrmModule.forFeature(ALL_ENTITIES)],
  providers: typeOrmRoot.length ? [SchemaDriftCheck] : [],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
