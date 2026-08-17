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
import {
  PUSH_ADAPTERS,
  QqbotAdapter,
  QqbotAuthService,
  QqbotMessageService,
  WxworkAdapter,
} from '../services/adapters';
import {
  QqbotCallbackService,
  QqbotCommandRouterService,
  QqbotEventDeduplicatorService,
  QqbotSignatureService,
} from '../services/callbacks';
import { PushApplicationsGameDailyService } from '../services/applications/game-daily/game-daily.service';

@Module({
  controllers: [
    PushApplicationsRepoController,
    PushApplicationsWeatherController,
    PushApplicationsGameDailyController,
    PushApplicationsMcServerController,
  ],
  providers: [
    BotKeyLoader,
    WxworkAdapter,
    QqbotAuthService,
    QqbotMessageService,
    QqbotAdapter,
    QqbotCallbackService,
    QqbotCommandRouterService,
    QqbotEventDeduplicatorService,
    QqbotSignatureService,
    {
      provide: PUSH_ADAPTERS,
      useFactory: (
        wxworkAdapter: WxworkAdapter,
        qqbotAdapter: QqbotAdapter,
      ) => [wxworkAdapter, qqbotAdapter],
      inject: [WxworkAdapter, QqbotAdapter],
    },
    PushService,
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    PushApplicationsGameDailyService,
    PushApplicationsMcServerService,
    PushApplicationsDeviceMonitorService,
    QqbotCallbackService,
    QqbotCommandRouterService,
    QqbotEventDeduplicatorService,
    QqbotSignatureService,
    QqbotMessageService,
  ],
  exports: [
    PushApplicationsRepoService,
    PushApplicationsWeatherService,
    PushApplicationsDeviceMonitorService,
    PushService,
    QqbotCallbackService,
    QqbotCommandRouterService,
    QqbotEventDeduplicatorService,
    QqbotSignatureService,
    QqbotMessageService,
  ],
})
export class PushApplicationsModule {}
