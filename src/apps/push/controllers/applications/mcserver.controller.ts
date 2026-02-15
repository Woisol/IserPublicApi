import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { McServerService } from '../../services/applications/mcserver.service';
// import * as mcserver from '../../types/applications/mcserver';
import { CompactLogger } from '@app/common/utils/logger';
import { type McServerWebhookPayload } from '../../types/applications/mcserver';

@Controller('push/mcserver')
export class McServerController {
  private readonly logger = new CompactLogger(McServerController.name);
  constructor(private readonly mcServerService: McServerService) {}

  @Post()
  handleMcServerPush(@Body() body: McServerWebhookPayload) {
    const { event, playerName, currentPlayers } = body;
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
        if (playerName && currentPlayers) {
          this.mcServerService.sendPlayerLeave(playerName, currentPlayers);
        } else {
          this.logger.error(
            'Player leave event missing playerName or currentPlayers',
          );
          return;
        }
    }
  }
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
