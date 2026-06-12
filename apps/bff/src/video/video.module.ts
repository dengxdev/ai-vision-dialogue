import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { CostModule } from '../cost/cost.module';
import { DialogueModule } from '../dialogue/dialogue.module';
import { VisionModule } from '../vision/vision.module';
import { VideoGateway } from './video.gateway';

@Module({
  imports: [VisionModule, CostModule, CacheModule, DialogueModule],
  providers: [VideoGateway],
  exports: [VideoGateway],
})
export class VideoModule {}
