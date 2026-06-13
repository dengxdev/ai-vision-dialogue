import { Module } from '@nestjs/common';
import { CostGuardian } from './cost.guardian';
import { CostService } from './cost.service';

@Module({
  providers: [CostGuardian, CostService],
  exports: [CostGuardian, CostService],
})
export class CostModule {}
