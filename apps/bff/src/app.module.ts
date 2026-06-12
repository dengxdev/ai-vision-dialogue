import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { CostModule } from './cost/cost.module';
import { DialogueModule } from './dialogue/dialogue.module';
import { VideoModule } from './video/video.module';
import { VisionModule } from './vision/vision.module';

@Module({
  imports: [VideoModule, VisionModule, DialogueModule, CostModule, CacheModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
