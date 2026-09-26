import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { McServerService } from '../../services/applications/mcserver/mcserver.service';
// import * as mcserver from '../../types/applications/mcserver';
import { CompactLogger } from '@app/common/utils/logger';
import { type McServerWebhookPayload } from '../../types/applications/mcserver';
import { parseQueryList } from '../utils/query';

@Controller('push/mcserver')
export class McServerController {
  private readonly logger = new CompactLogger(McServerController.name);
  constructor(private readonly mcServerService: McServerService) {}

  @Post()
  handleMcServerPush(@Body() body: McServerWebhookPayload) {
    const { event, playerName, currentPlayers, playTime } = body;
    switch (event) {
      case 'server_started':
        this.mcServerService.sendServerStart();
        break;
      case 'server_stopped':
        this.mcServerService.sendServerStop();
        break;
      case 'player_joined':
        if (playerName && currentPlayers) {
          this.mcServerService.sendPlayerJoin(playerName, currentPlayers);
        } else {
          this.logger.error(
            'Player join event missing playerName or currentPlayers',
          );
          return;
        }
        break;
      case 'player_left':
        if (playerName && currentPlayers && playTime) {
          this.mcServerService.sendPlayerLeave(
            playerName,
            currentPlayers,
            playTime,
          );
        } else {
          this.logger.error(
            'Player leave event missing playerName or currentPlayers or playTime',
          );
          return;
        }
    }
  }
  @Get('started')
  @Post('started')
  serverStarted() {
    this.mcServerService.sendServerStart();
  }

  @Get('stopped')
  @Post('stopped')
  serverStopped() {
    this.mcServerService.sendServerStop();
  }

  @Get('player-join')
  @Post('player-join')
  playerJoin(
    @Query() query: { playerName?: string; currentPlayers?: string },
    @Body() body: { playerName?: string; currentPlayers?: string },
  ) {
    const input = body && Object.keys(body).length ? body : query;
    const playerName = input.playerName as string;
    const currentPlayers = input.currentPlayers as string;
    const currentPlayersArr = parseQueryList(currentPlayers);
    this.mcServerService.sendPlayerJoin(playerName, currentPlayersArr);
  }

  @Get('player-leave')
  @Post('player-leave')
  playerLeave(
    @Query()
    query: {
      playerName?: string;
      curPlayers?: string;
      playTime?: string;
    },
    @Body()
    body: {
      playerName?: string;
      curPlayers?: string;
      playTime?: string;
    },
  ) {
    const input = body && Object.keys(body).length ? body : query;
    const playerName = input.playerName as string;
    const curPlayers = input.curPlayers as string;
    const playTime = input.playTime as string;
    const curPlayersArr = parseQueryList(curPlayers);
    this.mcServerService.sendPlayerLeave(playerName, curPlayersArr, playTime);
  }
}
