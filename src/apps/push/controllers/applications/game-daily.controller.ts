import { Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Post()
  gameDailyCheck_Post(@Query('name') name: string) {
    return this.gameDailyService.processGameDailyCheck(name);
  }

  @Get('/wake')
  wakeUpComputer() {
    return this.gameDailyService.wakeUpComputer();
  }
}
