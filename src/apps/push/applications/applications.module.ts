import { Module } from '@nestjs/common';
import {
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

@Module({
  controllers: [
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
  exports: [
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    DeviceMonitorService,
  ],
})
export class PushApplicationsModule { }
