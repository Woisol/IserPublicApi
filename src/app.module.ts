import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PushController } from './controllers/push';
import { PushService } from './services/push';
import { AuthorityApiKeyMiddleware } from './middleware/authority-api-key.middleware';

@Module({
  imports: [],
  controllers: [PushController],
  providers: [PushService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthorityApiKeyMiddleware).forRoutes('push/*');
  }
}
