import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';

@Module({
  imports: [HttpModule],
  controllers: [VisionController],
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
