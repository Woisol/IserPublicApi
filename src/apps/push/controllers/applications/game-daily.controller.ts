import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PushApplicationsGameDailyService } from '../../services/applications/game-daily/game-daily.service';

@Controller('push/game-daily')
export class GameDailyController {
  // private readonly logger = new CompactLogger(
  //   PushApplicationsGameDailyController.name,
  // );

  constructor(
    private readonly gameDailyService: PushApplicationsGameDailyService,
  ) {}

  @Get()
  gameDailyCheckByGet(
    @Query() query: { name?: string },
    @Body() body: { name?: string },
  ) {
    return this.gameDailyCheck(query, body);
  }

  @Post()
  gameDailyCheckByPost(
    @Query() query: { name?: string },
    @Body() body: { name?: string },
  ) {
    return this.gameDailyCheck(query, body);
  }

  private gameDailyCheck(
    query: { name?: string },
    body: { name?: string },
  ) {
    const input = body && Object.keys(body).length ? body : query;
    const name = input.name;
    return this.gameDailyService.processGameDailyCheck(name);
  }

  @Get('/wake')
  wakeUpComputer() {
    return this.gameDailyService.wakeUpComputer();
  }
}
