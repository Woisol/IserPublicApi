import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PushModule } from './apps/push/push.module';
import { AuthorityApiKeyMiddleware } from './common/middleware/authority-api-key.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'assets'),
      serveRoot: '/assets',
      serveStaticOptions: {
        maxAge: 0,
        etag: false,
        lastModified: false,
        cacheControl: false,
      },
    }),
    PushModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorityApiKeyMiddleware)
      .exclude('push/repo', 'push/game-daily', 'push/tt', 'cb/qqmsg')
      .forRoutes('push/*path');
  }
}
