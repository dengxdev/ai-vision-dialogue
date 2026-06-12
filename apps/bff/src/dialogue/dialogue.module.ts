import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VisionModule } from '../vision/vision.module';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';

@Module({
  imports: [HttpModule, VisionModule],
  controllers: [DialogueController],
  providers: [DialogueService],
  exports: [DialogueService],
})
export class DialogueModule {}
