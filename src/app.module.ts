import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import {
  PushRawMessageController,
  PushChannelsController,
  PushMessagesController,
  PushApplicationsRepoController,
  PushApplicationsWeatherController,
} from './apps/push/controllers';
import { PushService } from './apps/push/services';
import { BotKeyLoader } from './apps/push/services/botkey-loader';
import { PushApplicationsRepoService } from './apps/push/services/applications/repo.service';
import { PushApplicationsWeatherService } from './apps/push/services/applications/weather.service';
import { AuthorityApiKeyMiddleware } from './common/middleware/authority-api-key.middleware';
import { DeviceMonitorService } from './apps/push/services/applications';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    PushRawMessageController,
    PushChannelsController,
    PushMessagesController,
    PushApplicationsRepoController,
    PushApplicationsWeatherController,
  ],
  providers: [
    BotKeyLoader,
    PushService,
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    DeviceMonitorService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorityApiKeyMiddleware)
      .exclude('push/repo')
      .forRoutes('push/*');
  }
}
