import { Module } from '@nestjs/common';
import { HmacService } from './hmac.service';
import { ReplayProtectionService } from './replay-protection.service';

@Module({
  providers: [HmacService, ReplayProtectionService],
  exports: [HmacService, ReplayProtectionService],
})
export class SecurityModule {}