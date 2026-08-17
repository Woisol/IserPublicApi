import { Injectable } from '@nestjs/common';
import { PushService } from '../../push.service';

@Injectable()
export class McServerService {
  constructor(private readonly pushService: PushService) {}
  sendServerStart() {
    void this.pushService.sendMessage(
      'mcserver',
      { wxwork: 'mcserver' },
      { event: 'server_started' },
    );
  }

  sendServerStop() {
    void this.pushService.sendMessage(
      'mcserver',
      { wxwork: 'mcserver' },
      { event: 'server_stopped' },
    );
  }

  sendPlayerJoin(playerName: string, curPlayers: string[]) {
    void this.pushService.sendMessage(
      'mcserver',
      { wxwork: 'mcserver' },
      { event: 'player_joined', playerName, currentPlayers: curPlayers },
    );
  }

  sendPlayerLeave(playerName: string, curPlayers: string[], playTime?: string) {
    void this.pushService.sendMessage(
      'mcserver',
      { wxwork: 'mcserver' },
      {
        event: 'player_left',
        playerName,
        currentPlayers: curPlayers,
        playTime,
      },
    );
  }
}
