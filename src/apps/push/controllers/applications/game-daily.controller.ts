import { Controller, Get, Param, Query } from '@nestjs/common';
import { PushApplicationsGameDailyService } from '../../services/applications/game-daily.service';

@Controller('push/game-daily')
export class GameDailyController {
  // private readonly logger = new CompactLogger(
  //   PushApplicationsGameDailyController.name,
  // );

  constructor(
    private readonly gameDailyService: PushApplicationsGameDailyService,
  ) {}

  @Get()
  gameDailyCheck(@Query('name') name: string) {
    return this.gameDailyService.processGameDailyCheck(name);
  }
}
