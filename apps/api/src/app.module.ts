import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, AuthModule, AgentModule, BillingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
