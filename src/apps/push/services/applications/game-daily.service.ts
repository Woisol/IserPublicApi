import {
  HttpException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import { Cron } from '@nestjs/schedule';
import {
  GameLogFetchOption,
  GameLogFetchRawOption,
  GameLogFetchResult,
} from '../../types/applications/game-daily';
import {
  findGameLogFetchConfig,
  gameName2GameChannel,
} from './utils/game-daily';
import { WxwMarkdownInfo } from '../../types/wxw-webhook';
import { exec } from 'child_process';

/**
 * 自己写就乱（
 * 注意 webhook 来自自动软件！
 * 流程：Cron 4 点唤醒电脑 -> 自动任务启动每日，4:10 先原（PC 实现） -> 完成，工具发送 Webhook /push/game-daily?name=xxx -> 发送 bot 通知
 * 嗯
 */

@Injectable()
export class PushApplicationsGameDailyService {
  /** 游戏每日进度通知 */
  private readonly logger = new CompactLogger(
    PushApplicationsGameDailyService.name,
  );
  // 先硬编码了，@todo 使用配置文件
  private GAMELOGFETCH: GameLogFetchRawOption[] = [
    {
      gameName: 'Genshin',
      // 为空将始终成功
      successFlag: '今日奖励已领取',
      detailQuery: [
        {
          name: '剩余树脂',
          findStr: /(?<=原粹树脂：)\d+/g,
          index: -1,
        },
        {
          name: '完成时间',
          // findStr: /\d{2}:\d{2}:\d{2}(?=.*\n.*今日奖励已领取)/gm,
          // findStr: /\d{2}:\d{2}:\d{2}(?=[\s\S]*?今日奖励已领取)/g,
          //! 使用 \n 在 node 环境下无法匹配，使用 (?<!\d) 前面不是数字来隔断()
          findStr:
            /(?<!\d)\d{2}:\d{2}:\d{2}(?=(?:(?!\d{2}:\d{2}:\d{2})[\s\S])*?今日奖励已领取)/,
        },
      ],
    },
    {
      gameName: 'Star Rail',
      successFlag: '每日实训已完成',
      detailQuery: [
        {
          name: '剩余开拓力',
          findStr: /(?<=开拓力剩余)\d+(?=\/)/g,
        },
        {
          name: '完成时间',
          findStr: /\d{2}:\d{2}:\d{2}(?=.*每日实训已完成)/g,
        },
      ],
    },
  ];

  constructor(private readonly pushService: PushService) {}

  /**
   * ~~唤醒与自动任务触发
   * 不再定时唤醒，可能改为每天检查唤醒功能状态
   */
  // @Cron('0 6 * * *') // 每天6点触发
  // processGameDaily() {
  //   // throw new NotImplementedException();
  //   this.logger.log(
  //     '开始唤醒并触发每日任务，游戏列表：' +
  //       this.GAMELOGFETCH.map((g) => g.gameName).join(', '),
  //   );
  //   this.wakeUpComputer();
  // }

  /**
   * 唤醒电脑，如果失败发送消息
   */
  wakeUpComputer() {
    /**
     * 这里实现你的唤醒逻辑，暂时硬编码，调用本地的 sh 脚本实现
     */
    exec('~/sh/wake').on('exit', (code) => {
      if (code === 0) {
        this.logger.log('已发送唤醒信号');
        return 'success';
      } else {
        this.logger.error(`唤醒失败`);
        const message: WxwMarkdownInfo = {
          type: 'Wakeup',
          title: '❌ 电脑唤醒失败',
          content: ['⚠️ <font color="warning" > 请及时检查并修复问题 </font>'],
        };
        this.pushService.sendMarkdownInfoMessage(message, 'general');
        return message;
      }
    });
  }

  /**
   * 获取特定游戏每日完成情况并发送通知
   */
  async processGameDailyCheck(gameName: string) {
    if (!gameName) {
      this.logger.error('缺少名称查询 name');
      throw new HttpException('缺少名称查询 name', 400);
    }

    const today = new Date();
    const gameChannel = gameName2GameChannel(gameName);

    let message: WxwMarkdownInfo;

    try {
      const game = findGameLogFetchConfig(this.GAMELOGFETCH, gameName, today);
      const logRes: GameLogFetchResult = await this._fetchGameLog(game);

      if (!logRes.querySuccess) {
        this.logger.error(`无法获取 ${gameName} 的日志`);
        message = {
          title: `⚠️ ${gameName} 每日完成情况获取失败`,
          content: [{ 详情: '无法获取日志' }],
        };
        await this.pushService.sendMarkdownInfoMessage(message, gameChannel);
        return message;
      }

      message = {
        title: logRes.dailyCompleted
          ? `✅ ${gameName} 每日任务已完成`
          : `❌ ${gameName} 每日任务未完成`,
        content: logRes.details,
      };
      await this.pushService.sendMarkdownInfoMessage(message, gameChannel);
      this.logger.info('已发送每日任务情况通知');
      return message;
    } catch (error) {
      this.logger.error(error);
      message = {
        title: `⚠️ ${gameName} 每日完成情况获取失败`,
        content: [{ 详情: error.message as string }],
      };
      await this.pushService.sendMarkdownInfoMessage(message, gameChannel);
      return message;
    }
  }

  /**
   * 获取任务日志
   * @param gameName 游戏名称
   * @param logUrl 日志地址
   * @param successFlag 成功标志
   * @param detailQuery 详情查询
   */
  private async _fetchGameLog({
    gameName,
    logUrl,
    successFlag: _successFlag,
    detailQuery,
  }: GameLogFetchOption): Promise<GameLogFetchResult> {
    const _res: Response = await fetch(logUrl, {
      method: 'GET',
    });
    if (!_res.ok) {
      this.logger.error(
        `无法获取 ${gameName} 的日志：${_res.status} ${_res.statusText}`,
      );
      return {
        querySuccess: false,
        dailyCompleted: false,
        details: [],
      } as GameLogFetchResult;
    }
    let logContent = await _res.text();

    let successFlag = logContent.includes(_successFlag);

    //! 针对原，处理 BGI 存在多日志的情况
    if (!successFlag && gameName === 'Genshin') {
      let hasStart = logContent.includes('任务启动！');
      if (!hasStart) {
        let _thisLogName = logUrl.pathname.split('/').slice(-1)[0];
        this.logger.warn(
          `${_thisLogName} 不包含本日进度，尝试获取当日其它日志`,
        );
        for (let i = 1; i <= 5; i++) {
          const alterLogUrl: URL = new URL(logUrl);
          alterLogUrl.pathname = alterLogUrl.pathname.replace(
            /(?=\.log)/,
            `_${i.toString().padStart(3, '0')}`,
          );
          _thisLogName = alterLogUrl.pathname.split('/').slice(-1)[0];

          const alterRes: Response = await fetch(alterLogUrl, {
            method: 'GET',
          });
          if (!alterRes.ok) {
            this.logger.warn(
              `当日不存在其它日志${alterLogUrl}：${alterRes.status} ${alterRes.statusText}`,
            );
            break;
          }
          const alterLogContent = await alterRes.text();
          if (!(hasStart = alterLogContent.includes('任务启动！'))) {
            this.logger.warn(`${_thisLogName} 不包含本日进度，继续尝试`);
          } else {
            this.logger.log(`使用日志 ${_thisLogName}`);
            logContent = alterLogContent;
            successFlag = logContent.includes(_successFlag);
            break;
          }
        }
        if (!hasStart) {
          this.logger.error(`尝试 5 次依然无法获取 ${gameName} 的当日日志`);
          return {
            querySuccess: false,
            dailyCompleted: false,
            details: [],
          } as GameLogFetchResult;
        }
      }
    }

    const details = detailQuery.map((query) => {
      const match = logContent.match(query.findStr);
      const _matchLen = match?.length ?? 0;
      const index = query.index ? (query.index + _matchLen) % _matchLen : 0;
      return { [query.name]: _matchLen ? match[index] : '' };
    });
    return {
      querySuccess: !!logContent,
      dailyCompleted: successFlag,
      details,
    } as GameLogFetchResult;
  }
}
