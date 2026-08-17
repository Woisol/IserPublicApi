import { Module } from '@nestjs/common';
import { PushChannelsController, QqbotCallbackController } from './controllers';
import { PushApplicationsModule } from './applications/applications.module';

@Module({
  imports: [PushApplicationsModule],
  controllers: [PushChannelsController, QqbotCallbackController],
  exports: [PushApplicationsModule],
})
export class PushModule {}
