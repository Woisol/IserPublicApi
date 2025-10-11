import { Module } from '@nestjs/common';
import {
  PushApplicationsGameDailyController,
  PushApplicationsRepoController,
  PushApplicationsWeatherController,
} from '../controllers';
import {
  PushApplicationsRepoService,
  PushApplicationsWeatherService,
  DeviceMonitorService,
} from '../services/applications';
import { BotKeyLoader } from '../services/botkey-loader';
import { PushService } from '../services';
import { PushApplicationsGameDailyService } from '../services/applications/game-daily.service';

@Module({
  controllers: [
    PushApplicationsRepoController,
    PushApplicationsWeatherController,
    PushApplicationsGameDailyController,
  ],
  providers: [
    BotKeyLoader,
    PushService,
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    PushApplicationsGameDailyService,
    DeviceMonitorService,
  ],
  exports: [
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    DeviceMonitorService,
  ],
})
export class PushApplicationsModule {}
