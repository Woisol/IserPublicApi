import { Injectable } from '@nestjs/common';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import { WxwMarkdownInfo, WxwMarkdownMessage } from '../../types/wxw-webhook';

@Injectable()
export class McServerService {
  private readonly logger = new CompactLogger(McServerService.name);
  constructor(private readonly pushService: PushService) {}
  sendServerStart() {
    const msg = '「Server」✅服务器启动成功';
    this._sendMarkdownToChannel(msg);
  }

  sendServerStop() {
    const msg = '「Server」❌服务器已关闭';
    this._sendMarkdownToChannel(msg);
  }

  sendPlayerJoin(playerName: string, curPlayers: string[]) {
    const msg: WxwMarkdownInfo = {
      type: 'Player',
      title: `🎮 ${playerName} 加入了服务器`,
      content: [
        { 当前在线: `${curPlayers.length}人` },
        {
          玩家列表: curPlayers.reduce(
            (acc, name, index) => acc + `\n\t${index + 1}. ${name}`,
            '',
          ),
        },
      ],
    };
    this._sendMarkdownInfoToChannel(msg);
  }

  sendPlayerLeave(playerName: string, curPlayers: string[]) {
    const msg: WxwMarkdownInfo = {
      type: 'Player',
      title: `🎮 ${playerName} 离开了服务器`,
      content: [
        { 当前在线: `${curPlayers.length}人` },
        {
          玩家列表: curPlayers.reduce(
            (acc, name, index) => acc + `\n\t${index + 1}. ${name}`,
            '',
          ),
        },
      ],
    };
    this._sendMarkdownInfoToChannel(msg);
  }

  _sendMarkdownToChannel(markdown: string) {
    this.pushService.sendMarkdownMessage(markdown, 'mcserver');
  }

  _sendMarkdownInfoToChannel(markdownInfo: WxwMarkdownInfo) {
    this.pushService.sendMarkdownInfoMessage(markdownInfo, 'mcserver');
  }
}
