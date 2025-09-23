import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PushController } from './apps/push/controllers';
import { PushService } from './apps/push/services';
import { BotKeyLoader } from './apps/push/services/botkey-loader';
import { AuthorityApiKeyMiddleware } from './common/middleware/authority-api-key.middleware';

@Module({
  imports: [],
  controllers: [PushController],
  providers: [BotKeyLoader, PushService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthorityApiKeyMiddleware).forRoutes('push/*');
  }
}
