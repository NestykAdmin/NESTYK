import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { checkSchemaDrift, describeSchemaDrift, isSchemaDriftError } from './schema-drift';

/** Logs entity/database mismatches at startup; never blocks the API. */
@Injectable()
export class SchemaDriftCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger('SchemaDrift');

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    void this.run();
  }

  private async run() {
    try {
      const issues = (await checkSchemaDrift(this.dataSource, process.env.DB_SCHEMA ?? 'public')).filter(
        isSchemaDriftError,
      );
      if (!issues.length) return;
      this.logger.error(
        [
          `entity กับฐานข้อมูลไม่ตรงกัน ${issues.length} จุด:`,
          ...issues.map((issue) => `  - ${describeSchemaDrift(issue)}`),
          'รัน `npm run db:check -w @nestyk/api` เพื่อดูรายละเอียดและปรับฐานข้อมูล',
        ].join('\n'),
      );
    } catch (error) {
      this.logger.warn(`ตรวจโครงสร้างฐานข้อมูลไม่สำเร็จ: ${(error as Error).message}`);
    }
  }
}
