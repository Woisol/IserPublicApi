import { Module } from '@nestjs/common';
import { PushChannelsController } from './controllers';
import { PushApplicationsModule } from './applications/applications.module';

@Module({
  imports: [PushApplicationsModule],
  controllers: [PushChannelsController],
  exports: [PushApplicationsModule],
})
export class PushModule {}
