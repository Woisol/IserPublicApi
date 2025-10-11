import { Injectable, NotImplementedException } from '@nestjs/common';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import { Cron } from '@nestjs/schedule';
import {
  GameLogFetchOption,
  GameLogFetchRawOption,
  GameLogFetchResult,
} from '../../types/applications/game-daily';
import { factoryGameLogURL, gameName2GameChannel } from './utils/game-daily';
import { WxwMarkdownInfo } from '../../types/wxw-webhook';

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
  private GAMELOGFETCH: GameLogFetchRawOption[] = [
    {
      gameName: 'Genshin',
      successFlag: '',
      detailQuery: [
        {
          name: '剩余树脂',
          findStr: /(?<=原粹树脂：)\d+/g,
        },
        {
          name: '完成时间',
          findStr: /a/g,
        },
      ],
    },
    {
      gameName: 'Star Rail',
      successFlag: '',
      detailQuery: [
        {
          name: '剩余开拓力',
          findStr: /(?<=开拓力剩余：)\d+(?=\/)/g,
        },
        {
          name: '完成时间',
          findStr: /a/g,
        },
      ],
    },
  ];

  private _findGameLogFetchConfig(
    gameName: string,
    date: Date = new Date(),
  ): GameLogFetchOption {
    const _option = this.GAMELOGFETCH.find((g) => g.gameName === gameName);
    if (!_option) {
      throw new Error(`未找到游戏 ${gameName} 的日志配置`);
    }
    _option['logUrl'] = factoryGameLogURL(gameName, date);
    return _option as GameLogFetchOption;
  }

  constructor(private readonly pushService: PushService) {}

  /**
   * 唤醒与自动任务触发
   */
  @Cron('10 4 * * *') // 每天4点10分触发
  processGameDaily() {
    throw new NotImplementedException();
    this.logger.log(
      '开始唤醒并触发每日任务，游戏列表：' +
        this.GAMELOGFETCH.map((g) => g.gameName).join(', '),
    );
    await this.wakeUpComputer();
  }

  /**
   * 唤醒电脑，如果失败发送消息
   */
  async wakeUpComputer() {
    throw new NotImplementedException();
  }

  /**
   * 获取特定游戏每日完成情况并发送通知
   */
  async processGameDailyCheck(gameName: string) {
    const today = new Date();
    const gameChannel = gameName2GameChannel(gameName);

    let message: WxwMarkdownInfo;

    try {
      const game = this._findGameLogFetchConfig(gameName, today);
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
    const logContent: string | null = await fetch(logUrl, {
      method: 'GET',
    })
      .then((res) => res.text())
      .catch((err) => {
        this.logger.error(`Failed to fetch log ${gameName}:`, err);
        return null;
      });

    const successFlag = logContent.includes(_successFlag);
    const details = detailQuery.map((query) => {
      const match = logContent.match(query.findStr);
      return { [query.name]: match ? match[1] : null };
    });
    return {
      querySuccess: !!logContent,
      dailyCompleted: successFlag,
      details,
    } as GameLogFetchResult;
  }
}
