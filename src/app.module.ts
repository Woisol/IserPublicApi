import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PushModule } from './apps/push/push.module';
import { AuthorityApiKeyMiddleware } from './common/middleware/authority-api-key.middleware';

@Module({
  imports: [ScheduleModule.forRoot(), PushModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorityApiKeyMiddleware)
      .exclude('push/repo', 'push/game-daily')
      .forRoutes('push/*path');
  }
}
