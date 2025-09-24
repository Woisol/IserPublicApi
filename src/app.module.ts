import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  PushRawMessageController,
  PushChannelsController,
  PushMessagesController,
  PushApplicationsRepoController,
} from './apps/push/controllers';
import { PushService } from './apps/push/services';
import { BotKeyLoader } from './apps/push/services/botkey-loader';
import { PushApplicationsRepoService } from './apps/push/services/applications/repo.service';
import { AuthorityApiKeyMiddleware } from './common/middleware/authority-api-key.middleware';
import { ApplicationsRepoController } from './apps/push/controllers/applications/repo.controller';

@Module({
  imports: [],
  controllers: [
    PushRawMessageController,
    PushChannelsController,
    PushMessagesController,
    PushApplicationsRepoController,
    ApplicationsRepoController,
  ],
  providers: [BotKeyLoader, PushService, PushApplicationsRepoService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorityApiKeyMiddleware)
      .exclude('push/repo')
      .forRoutes('push/*');
  }
}
