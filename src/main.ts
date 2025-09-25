import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnvFile } from 'process';
import { existsSync } from 'fs';
import { CompactLogger } from './common/utils/logger';

if (existsSync('.env')) {
  loadEnvFile('.env');
}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CompactLogger(),
  });
  const port = process.env.SERVER_PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
