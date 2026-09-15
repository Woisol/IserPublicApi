import { Injectable } from '@nestjs/common';
import { CompactLogger } from '@app/common/utils/logger';
import type {
  DevicePushDetails,
  ComfyUiPushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  PushChannelTarget,
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
import {
  formatDuration,
  formatHourMinute,
  formatUptime,
  shortenGitMessage,
} from '@app/common/utils/format';

@Injectable()
export class WxworkAdapter implements PushAdapter {
  readonly name = 'wxwork' as const;
  private readonly logger = new CompactLogger(WxworkAdapter.name);
  private readonly builder = wxworkMessageBuilder();
  private readonly timeout = 10000;

  constructor(private readonly botKeyLoader: BotKeyLoader) {}

  getAvailableChannels(): string[] {
    return this.botKeyLoader.getAvailableChannels(this.name);
  }

  async sendGameDaily(
    channel: PushChannelTarget,
    details: GameDailyPushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
    if (details.wakeupSuccessful === false) {
      await this.send(
        target,
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

    await this.send(target, this.builder.markdownInfo({ title, content }));
  }

  async sendWeather(
    channel: PushChannelTarget,
    details: WeatherPushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
    if (details.kind === 'minutely-rain') {
      const minutesUntilRain = Math.max(
        Math.round((details.startsAt.getTime() - Date.now()) / 60000),
        0,
      );
      const timeline = details.precipitationTimeline
        .map((precipitation) => `${precipitation.toFixed(2)}mm`)
        .join('|');
      const peakAt = formatHourMinute(details.peakAt);
      await this.send(
        target,
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
    await this.send(target, this.builder.text(`⚠️ 今天${periods}可能下雨`));
  }

  async sendRepo(
    channel: PushChannelTarget,
    details: RepoPushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
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
            { 提交: shortenGitMessage(workflowRun.head_commit.message) },
            { 仓库: `[${repository.name}](${repository.html_url})` },
            { 分支: `\`${workflowRun.head_branch}\`` },
            { 执行时长: formatDuration(duration) },
            ...(failed
              ? ['⚠️ <font color="warning">请及时检查并修复问题</font>']
              : []),
          ],
        };
        break;
      }
      default:
        throw new Error('Unsupported GitHub webhook event');
    }

    await this.send(target, this.builder.markdownInfo(message));
  }

  async sendMcServer(
    channel: PushChannelTarget,
    details: McServerPushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
    if (details.event === 'server_started') {
      await this.send(
        target,
        this.builder.markdown('「Server」✅服务器启动成功'),
      );
      return;
    }
    if (details.event === 'server_stopped') {
      await this.send(
        target,
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
      target,
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

  async sendDevice(
    channel: PushChannelTarget,
    details: DevicePushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
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
      target,
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
              已运行时间: formatUptime(details.uptimeSeconds),
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

  async sendComfyUi(
    channel: PushChannelTarget,
    details: ComfyUiPushDetails,
  ): Promise<void> {
    const target = this.normalizeChannel(channel);
    const success = details.status === 'success';
    await this.send(
      target,
      this.builder.markdownInfo({
        type: 'ComfyUI',
        title: `${success ? '✅' : '❌'} ComfyUI ${success ? '生成成功' : '生成失败'}`,
        content: [
          { Seed: details.seed.toString() },
          { 耗时: `${details.elapsed}秒` },
          { 分辨率: details.res.toString() },
          { 放大倍率: details.scale.toString() },
          { 生成时长: `${details.duration}秒` },
          { 文件名: details.filename },
          { 路径: details.path },
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

  private normalizeChannel(channel: PushChannelTarget): string {
    if (typeof channel !== 'string') {
      throw new Error('Wxwork channel must be a string');
    }
    return channel;
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
}
