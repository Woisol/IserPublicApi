import { Injectable } from '@nestjs/common';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import { WxwMarkdownInfo } from '../../types/wxw-webhook';
import { formatMcServerPlayerList } from './utils/mcserver';

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
      title: `🎮 <font color="info">${playerName} 加入了服务器</font>`,
      content: [
        { 当前在线: `${curPlayers.length}人` },
        {
          玩家列表: formatMcServerPlayerList(curPlayers),
        },
      ],
    };
    this._sendMarkdownInfoToChannel(msg);
  }

  sendPlayerLeave(playerName: string, curPlayers: string[], playTime?: string) {
    const msg: WxwMarkdownInfo = {
      type: 'Player',
      title: `👋 <font color="warning">${playerName} 离开了服务器</font>`,
      content: [
        { 游玩时长: playTime ? playTime : '未知' },
        { 当前在线: `${curPlayers.length}人` },
        {
          玩家列表: formatMcServerPlayerList(curPlayers),
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
