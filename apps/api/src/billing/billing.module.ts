import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({ imports: [AuthModule, PrismaModule], controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
