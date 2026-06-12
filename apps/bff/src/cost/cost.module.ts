import { Module } from '@nestjs/common';
import { CostGuardian } from './cost.guardian';

@Module({
  providers: [CostGuardian],
  exports: [CostGuardian],
})
export class CostModule {}
