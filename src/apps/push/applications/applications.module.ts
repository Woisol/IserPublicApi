import { Module } from '@nestjs/common';
import {
  PushApplicationsGameDailyController,
  PushApplicationsMcServerController,
  PushApplicationsRepoController,
  PushApplicationsWeatherController,
} from '../controllers';
import {
  PushApplicationsRepoService,
  PushApplicationsWeatherService,
  PushApplicationsMcServerService,
  PushApplicationsDeviceMonitorService,
} from '../services/applications';
import { BotKeyLoader } from '../services/botkey-loader';
import { PushService } from '../services';
import { PushApplicationsGameDailyService } from '../services/applications/game-daily.service';

@Module({
  controllers: [
    PushApplicationsRepoController,
    PushApplicationsWeatherController,
    PushApplicationsGameDailyController,
    PushApplicationsMcServerController,
  ],
  providers: [
    BotKeyLoader,
    PushService,
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    PushApplicationsGameDailyService,
    PushApplicationsMcServerService,
    PushApplicationsDeviceMonitorService,
  ],
  exports: [
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    PushApplicationsDeviceMonitorService,
  ],
})
export class PushApplicationsModule {}
