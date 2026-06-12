import { Module } from '@nestjs/common';
import { VisionModule } from '../vision/vision.module';
import { DialogueService } from './dialogue.service';

@Module({
  imports: [VisionModule],
  providers: [DialogueService],
  exports: [DialogueService],
})
export class DialogueModule {}
