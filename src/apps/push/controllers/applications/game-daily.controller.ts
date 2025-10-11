import { Controller, Get, Param } from '@nestjs/common';
import { PushApplicationsGameDailyService } from '../../services/applications/game-daily.service';

@Controller('push/game-daily')
export class PushApplicationsGameDailyController {
  // private readonly logger = new CompactLogger(
  //   PushApplicationsGameDailyController.name,
  // );

  constructor(
    private readonly gameDailyService: PushApplicationsGameDailyService,
  ) {}

  @Get()
  gameDailyCheck(@Param('name') name: string) {
    return this.gameDailyService.processGameDailyCheck(name);
  }
}
