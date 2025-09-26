import { Module } from '@nestjs/common';
import {
  PushRawMessageController,
  PushChannelsController,
  PushMessagesController,
} from './controllers';
import { PushService } from './services';
import { BotKeyLoader } from './services/botkey-loader';
import { PushApplicationsModule } from './applications/applications.module';

@Module({
  imports: [PushApplicationsModule],
  controllers: [
    PushRawMessageController,
    PushChannelsController,
    PushMessagesController,
  ],
  providers: [BotKeyLoader, PushService],
  exports: [PushService, PushApplicationsModule],
})
export class PushModule {}
