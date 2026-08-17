import { Injectable } from '@nestjs/common';
import { CompactLogger } from '@app/common/utils/logger';
import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  RepoPushDetails,
  WeatherPushDetails,
} from '@app/apps/push/types/push-message';
import type {
  IssuesWebhookPayload,
  MemberWebhookPayload,
  ReleaseWebhookPayload,
  WorkflowRunWebhookPayload,
} from '@app/apps/push/types/applications/repo';
import { GitHubWebhookEvent } from '@app/apps/push/types/applications/repo.runtime';
import type {
  WxwMarkdownInfo,
  WxwMessage,
  WxwWebhookResponse,
} from '@app/apps/push/types/wxwork-webhook';
import { WxwMessageType } from '@app/apps/push/types/wxwork-webhook.runtime';
import { BotKeyLoader } from '../../botkey-loader';
import type { PushAdapter } from '@app/apps/push/types/push-adapter';
import { wxworkMessageBuilder } from './wxwork-message-builder';

@Injectable()
export class WxworkAdapter implements PushAdapter {
  private readonly logger = new CompactLogger(WxworkAdapter.name);
  private readonly builder = wxworkMessageBuilder();
  private readonly timeout = 10000;

  constructor(private readonly botKeyLoader: BotKeyLoader) {}

  getAvailableChannels(): string[] {
    return this.botKeyLoader.getAvailableChannels();
  }

  async sendGameDaily(
    channel: string,
    details: GameDailyPushDetails,
  ): Promise<void> {
    if (details.wakeupSuccessful === false) {
      await this.send(
        channel,
        this.builder.markdownInfo({
          type: 'Wakeup',
          title: '❌ 电脑唤醒失败',
          content: ['⚠️ <font color="warning">请及时检查并修复问题</font>'],
        }),
      );
      return;
    }

    const title =
      details.status === 'finished'
        ? `✅ ${details.gameName} 每日任务已完成`
        : details.status === 'unfinished'
          ? `❌ ${details.gameName} 每日任务未完成`
          : `⚠️ ${details.gameName} 每日完成情况获取失败`;
    const content =
      details.status === 'failed'
        ? [{ 详情: details.failureReason || '无法获取日志' }]
        : details.detail;

    await this.send(channel, this.builder.markdownInfo({ title, content }));
  }

  async sendWeather(
    channel: string,
    details: WeatherPushDetails,
  ): Promise<void> {
    if (details.kind === 'minutely-rain') {
      const minutesUntilRain = Math.max(
        Math.round((details.startsAt.getTime() - Date.now()) / 60000),
        0,
      );
      const timeline = details.precipitationTimeline
        .map((precipitation) => `${precipitation.toFixed(2)}mm`)
        .join('|');
      const peakAt = this.formatHourMinute(details.peakAt);
      await this.send(
        channel,
        this.builder.text(
          `⚠️ 预计 ${minutesUntilRain}min 后开始下雨\n预报降雨量 ${timeline}，峰值 ${details.peakPrecipitation.toFixed(2)}mm/5min（${peakAt}）`,
        ),
      );
      return;
    }

    const periods = details.periods
      .map((period) => {
        const startHour = period.startTime.getHours();
        const endHour = period.endTime.getHours();
        return startHour === endHour
          ? `${startHour}点`
          : `${startHour}-${endHour}点`;
      })
      .join('、');
    await this.send(channel, this.builder.text(`⚠️ 今天${periods}可能下雨`));
  }

  async sendRepo(channel: string, details: RepoPushDetails): Promise<void> {
    let message: WxwMarkdownInfo;

    switch (details.event) {
      case GitHubWebhookEvent.MEMBER: {
        const payload = details.payload as MemberWebhookPayload;
        const { action, member, repository, changes } = payload;
        if (action === 'added') {
          message = {
            type: 'Collaborate',
            title: `新增协作者 <font color="info">${member.login}</font>`,
            content: [{ 仓库: `[${repository.name}](${repository.html_url})` }],
          };
        } else if (action === 'removed') {
          message = {
            type: 'Collaborate',
            title: `移除协作者 <font color="warning">${member.login}</font>`,
            content: [{ 仓库: `[${repository.name}](${repository.html_url})` }],
          };
        } else if (action === 'edited') {
          message = {
            type: 'Collaborate',
            title: '权限变更',
            content: [
              { 仓库: `[${repository.name}](${repository.html_url})` },
              { 成员: member.login },
              {
                变更: `${changes?.permission?.from || '未知'} → ${changes?.permission?.to || '未知'}`,
              },
            ],
          };
        } else {
          message = {
            type: 'Collaborate',
            title: '未知操作',
            content: [{ 操作类型: action }],
          };
        }
        break;
      }
      case GitHubWebhookEvent.ISSUES: {
        const payload = details.payload as IssuesWebhookPayload;
        const { action, issue, repository, sender } = payload;
        if (action === 'opened') {
          message = {
            type: 'Issue',
            title: '新建 Issue',
            content: [
              { 标题: `[#${issue.number} ${issue.title}](${issue.html_url})` },
              { 仓库: `[${repository.full_name}](${repository.html_url})` },
              { 创建者: sender.login },
              { 创建时间: new Date(issue.created_at).toLocaleString('zh-CN') },
              ...(issue.body
                ? [
                    {
                      描述:
                        issue.body.substring(0, 200) +
                        (issue.body.length > 200 ? '...' : ''),
                    },
                  ]
                : []),
            ],
          };
        } else {
          message = {
            type: 'Issue',
            title: `${action} Issue`,
            content: [
              { 标题: `[#${issue.number} ${issue.title}](${issue.html_url})` },
              { 仓库: `[${repository.full_name}](${repository.html_url})` },
              { 操作者: sender.login },
              { 操作时间: details.receivedAt.toLocaleString('zh-CN') },
            ],
          };
        }
        break;
      }
      case GitHubWebhookEvent.RELEASE: {
        const payload = details.payload as ReleaseWebhookPayload;
        const { action, release, repository } = payload;
        if (action === 'published') {
          message = {
            type: 'Release',
            title: `<font color="info">[${release.tag_name}](${release.html_url})</font> 发布`,
            content: [
              { 版本名称: release.name || release.tag_name },
              { 仓库: `[${repository.name}](${repository.html_url})` },
              {
                发布时间: new Date(
                  release.published_at || details.receivedAt,
                ).toLocaleString('zh-CN'),
              },
              ...(release.body
                ? [
                    {
                      发布说明:
                        release.body.substring(0, 300) +
                        (release.body.length > 300 ? '...' : ''),
                    },
                  ]
                : []),
            ],
          };
        } else {
          message = {
            type: 'Release',
            title: `${action} Release`,
            content: [
              { 版本: `[${release.tag_name}](${release.html_url})` },
              { 仓库: `[${repository.name}](${repository.html_url})` },
              { 操作时间: details.receivedAt.toLocaleString('zh-CN') },
            ],
          };
        }
        break;
      }
      case GitHubWebhookEvent.WORKFLOW_RUN: {
        const payload = details.payload as WorkflowRunWebhookPayload;
        const { workflow_run: workflowRun, repository } = payload;
        const duration =
          workflowRun.run_started_at && workflowRun.updated_at
            ? Math.round(
                (new Date(workflowRun.updated_at).getTime() -
                  new Date(workflowRun.run_started_at).getTime()) /
                  1000,
              )
            : 0;
        const succeeded = workflowRun.conclusion === 'success';
        const failed = workflowRun.conclusion === 'failure';
        const status = succeeded
          ? '执行成功'
          : failed
            ? '执行失败'
            : '执行结束';
        const icon = succeeded ? '✅' : failed ? '❌' : '⚠️';
        message = {
          type: 'Workflow',
          title: `${icon} [${workflowRun.name}](${workflowRun.html_url}) ${status}`,
          content: [
            { 提交: this.shortenGitMessage(workflowRun.head_commit.message) },
            { 仓库: `[${repository.name}](${repository.html_url})` },
            { 分支: `\`${workflowRun.head_branch}\`` },
            { 执行时长: this.formatDuration(duration) },
            ...(failed
              ? ['⚠️ <font color="warning">请及时检查并修复问题</font>']
              : []),
          ],
        };
        break;
      }
      default:
        throw new Error(`Unsupported GitHub webhook event: ${details.event}`);
    }

    await this.send(channel, this.builder.markdownInfo(message));
  }

  async sendMcServer(
    channel: string,
    details: McServerPushDetails,
  ): Promise<void> {
    if (details.event === 'server_started') {
      await this.send(
        channel,
        this.builder.markdown('「Server」✅服务器启动成功'),
      );
      return;
    }
    if (details.event === 'server_stopped') {
      await this.send(
        channel,
        this.builder.markdown('「Server」❌服务器已关闭'),
      );
      return;
    }

    const players = details.currentPlayers || [];
    const playerList = players.length
      ? players.join(' | ')
      : '当前没有玩家在线';
    const joined = details.event === 'player_joined';
    await this.send(
      channel,
      this.builder.markdownInfo({
        type: 'Player',
        title: joined
          ? `🎮 <font color="info">${details.playerName} 加入了服务器</font>`
          : `👋 <font color="warning">${details.playerName} 离开了服务器</font>`,
        content: [
          ...(joined ? [] : [{ 游玩时长: details.playTime || '未知' }]),
          { 当前在线: `${players.length}人` },
          { 玩家列表: playerList },
        ],
      }),
    );
  }

  async sendDevice(channel: string, details: DevicePushDetails): Promise<void> {
    const cpuUsage = details.cpuUsage.toFixed(2);
    const memoryUsage = details.memoryUsage.toFixed(2);
    const applicationDetails = details.highCpuApplications.length
      ? Object.fromEntries(
          details.highCpuApplications.map((application) => [
            `${application.name} (PID ${application.pid})`,
            `${application.usage.toFixed(2)}%`,
          ]),
        )
      : {
          状态: `未发现 CPU 占用率超过 ${details.highCpuApplicationThreshold}% 的应用`,
        };

    await this.send(
      channel,
      this.builder.markdownInfo({
        type: 'Device',
        title:
          details.cpuSeverity === 'critical'
            ? '⚠️`CPU 负载严重过高！`⚠️'
            : '<font color="warning">CPU 高负载预警！</font>',
        content: [
          {
            使用率:
              details.cpuSeverity === 'critical'
                ? `\`${cpuUsage}%\``
                : `${cpuUsage}%`,
          },
          { 检测时间: details.checkedAt.toLocaleString('zh-CN') },
          {
            系统信息: {
              内存占用:
                details.memorySeverity === 'critical'
                  ? `\`${memoryUsage}%\``
                  : details.memorySeverity === 'warning'
                    ? `<font color="warning">${memoryUsage}%</font>`
                    : `${memoryUsage}%`,
              已运行时间: this.formatUptime(details.uptimeSeconds),
              系统: details.platform,
              CPU: details.cpuModel,
              核心数: details.cpuCount.toString(),
            },
          },
          { '高 CPU 应用': applicationDetails },
        ],
      }),
    );
  }

  private async send(channel: string, message: WxwMessage): Promise<void> {
    if (!this.validateMessage(message)) {
      throw new Error('Invalid wxwork message format');
    }

    const webhookUrl = this.botKeyLoader.getWebhookUrl(channel);
    if (!webhookUrl) {
      throw new Error(
        `Channel '${channel}' not found or has no key configured`,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as WxwWebhookResponse;
      if (result.errcode !== 0) {
        throw new Error(
          `Wxwork API error: ${result.errmsg} (${result.errcode})`,
        );
      }
      this.logger.log(`Message sent to channel ${channel}:`, result);
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channel}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateMessage(message: WxwMessage): boolean {
    switch (message.msgtype) {
      case WxwMessageType.TEXT:
        return Boolean(message.text?.content);
      case WxwMessageType.MARKDOWN:
        return Boolean(message.markdown?.content);
      case WxwMessageType.IMAGE:
        return Boolean(message.image?.base64 && message.image.md5);
      case WxwMessageType.NEWS:
        return Boolean(message.news?.articles.length);
      case WxwMessageType.FILE:
        return Boolean(message.file?.media_id);
      case WxwMessageType.TEMPLATE_CARD:
        return Boolean(message.template_card);
      default:
        return false;
    }
  }

  //TODO 迁移 util 函数
  private formatHourMinute(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private formatDuration(seconds: number): string {
    return seconds > 0
      ? `${Math.floor(seconds / 60)}分${seconds % 60}秒`
      : '未知';
  }

  private formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  }

  private shortenGitMessage(message: string): string {
    return message
      .replace(/:\w+:/g, '')
      .replace(
        /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
        '',
      )
      .replace(/\n.*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
