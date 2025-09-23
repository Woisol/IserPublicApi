import { Module } from '@nestjs/common';
import { PushController } from './controllers/push';
import { PushService } from './services/push';

@Module({
  imports: [],
  controllers: [PushController],
  providers: [PushService],
})
export class AppModule {}
