import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const port = process.env.BFF_PORT
    ? parseInt(process.env.BFF_PORT, 10)
    : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`BFF is running on: http://localhost:${port}`);
}

void bootstrap();
