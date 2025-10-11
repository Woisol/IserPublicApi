import { Injectable } from '@nestjs/common';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';
import { Cron } from '@nestjs/schedule';
import {
  GameLogFetchOption,
  GameLogFetchResult,
} from '../../types/applications/game-daily';
import {
  factoryGenshinLogURL,
  factoryStarrailLogURL,
} from './utils/game-daily';

@Injectable
export class PushApplicationsGameDailyService {
  /** 游戏每日进度通知 */
  private readonly logger = new CompactLogger(
    PushApplicationsGameDailyService.name,
  );
  private readonly GAMELOGFETCH: GameLogFetchOption[] = [
    {
      gameName: 'Genshin',
      logUrl: factoryGenshinLogURL(new Date()),
      successFlag: '',
      detailQuery: [
        {
          name: '剩余树脂',
          findStr: /(?<=原粹树脂：)\d+/g,
        },
      ],
    },
    {
      gameName: 'Star Rail',
      logUrl: factoryStarrailLogURL(new Date()),
      successFlag: '',
      detailQuery: [
        {
          name: '剩余开拓力',
          findStr: /(?<=开拓力剩余：)\d+(?=\/)/g,
        },
      ],
    },
  ];

  constructor(private readonly pushService: PushService) {}

  /**
   * 唤醒与自动任务触发
   */
  @Cron('10 4 * * *') // 每天4点10分触发
  handleDailyGameProgress() {
    this.logger.log('开始唤醒并触发每日任务，游戏列表：' + '');
  }

  /**
   * 唤醒电脑
   */
  async wakeUpComputer() {}

  /**
   * 获取每日完成情况
   */
  async getDailyGameProgress() {
    const today = new Date();
  }

  /**
   * 获取任务日志
   */
  private async _fetchGameLog(
    logFetchOption: GameLogFetchOption,
  ): Promise<GameLogFetchResult> {
    const logContent: string | null = await fetch(logFetchOption.logUrl, {
      method: 'GET',
    })
      .then((res) => res.text())
      .catch((err) => {
        this.logger.error(
          `Failed to fetch log ${logFetchOption.gameName}:`,
          err,
        );
        return null;
      });

    const successFlag = logContent.includes(logFetchOption.successFlag);
    const details = logFetchOption.detailQuery.map((query) => {
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
