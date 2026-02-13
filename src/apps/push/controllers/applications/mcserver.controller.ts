import { Controller, Get, Query } from '@nestjs/common';
import { McServerService } from '../../services/applications/mcserver.service';

@Controller('push/mcserver')
export class McServerController {
  constructor(private readonly mcServerService: McServerService) {}

  @Get('started')
  serverStarted() {
    this.mcServerService.sendServerStart();
  }

  @Get('stopped')
  serverStopped() {
    this.mcServerService.sendServerStop();
  }

  @Get('player-join')
  playerJoin(
    @Query('playerName') playerName: string,
    @Query('curPlayers') curPlayers: string,
  ) {
    const curPlayersArr = curPlayers ? curPlayers.split(',') : [];
    this.mcServerService.sendPlayerJoin(playerName, curPlayersArr);
  }

  @Get('player-leave')
  playerLeave(
    @Query('playerName') playerName: string,
    @Query('curPlayers') curPlayers: string,
  ) {
    const curPlayersArr = curPlayers ? curPlayers.split(',') : [];
    this.mcServerService.sendPlayerLeave(playerName, curPlayersArr);
  }
}
