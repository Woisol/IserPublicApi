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
import { gameName2GameChannel } from '../applications/game-daily/game-daily.util';

@Injectable()
export class MarkdownMessageHelper {
  private readonly logger = new CompactLogger(MarkdownMessageHelper.name);
  private missingBaseUrlWarned = false;

  buildGameDailyMarkdown(details: GameDailyPushDetails): string {
    if (details.wakeupSuccessful === false) {
      return this.buildMessage(
        '❌ 电脑唤醒失败',
        'wakeup.failed.png',
        '> 请及时检查并修复问题',
      );
    }

    const title =
      details.status === 'finished'
        ? `✅ ${this.escapeText(details.gameName)} 每日任务已完成`
        : details.status === 'unfinished'
          ? `❌ ${this.escapeText(details.gameName)} 每日任务未完成`
          : `⚠️ ${this.escapeText(details.gameName)} 每日完成情况获取失败`;
    const detail =
      details.status === 'failed'
        ? this.field('详情', details.failureReason || '无法获取日志')
        : details.detail
          .flatMap((item) =>
            Object.entries(item).map(([key, value]) =>
              this.field(key, value ?? ''),
            ),
          )
          .join('\n');

    return this.buildMessage(
      title,
      `games/${this.gameImageSlug(details.gameName)}.${details.status}.png`,
      detail,
    );
  }

  buildWeatherMarkdown(details: WeatherPushDetails): string {
    if (details.kind === 'minutely-rain') {
      const minutesUntilRain = Math.max(
        Math.round((details.startsAt.getTime() - Date.now()) / 60000),
        0,
      );
      const timeline = details.precipitationTimeline
        .map((precipitation) => `${precipitation.toFixed(2)}mm`)
        .join('|');
      return this.buildMessage(
        '⚠️ 降雨预警',
        'weather.minutely.png',
        [
          this.field('预计开始', `${minutesUntilRain}min 后`),
          this.fieldMarkdown('降雨量', timeline),
          this.field(
            '峰值',
            `${details.peakPrecipitation.toFixed(2)}mm（${this.formatHourMinute(details.peakAt)}）`,
          ),
        ].join('\n'),
      );
    }

    const periods = details.periods
      .map((period) => {
        const startHour = period.startTime.getHours();
        const endHour = period.endTime.getHours();
        return startHour === endHour
          ? `${startHour}点`
          : `${startHour}-${endHour}点`;
      })
      .map((period) => `- ${period}`)
      .join('\n');
    return this.buildMessage(
      '⚠️ 今日降雨预警',
      'weather.daily.png',
      `${this.field('降雨时段', '')}\n${periods}`,
    );
  }

  buildRepoMarkdown(details: RepoPushDetails): string {
    switch (details.event) {
      case GitHubWebhookEvent.MEMBER:
        return this.buildMemberMarkdown(
          details.payload as MemberWebhookPayload,
        );
      case GitHubWebhookEvent.ISSUES:
        return this.buildIssuesMarkdown(details);
      case GitHubWebhookEvent.RELEASE:
        return this.buildReleaseMarkdown(details);
      case GitHubWebhookEvent.WORKFLOW_RUN:
        return this.buildWorkflowMarkdown(details);
      default:
        throw new Error(`Unsupported GitHub webhook event: ${details.event}`);
    }
  }

  buildMcServerMarkdown(details: McServerPushDetails): string {
    if (details.event === 'server_started') {
      return this.buildMessage('✅ Minecraft 服务器启动成功');
    }
    if (details.event === 'server_stopped') {
      return this.buildMessage('❌ Minecraft 服务器已关闭');
    }

    const players = details.currentPlayers || [];
    const playerList = players.length
      ? players.map((player) => `- ${this.escapeText(player)}`).join('\n')
      : '当前没有玩家在线';
    const joined = details.event === 'player_joined';
    return this.buildMessage(
      joined
        ? `🎮 ${this.escapeText(details.playerName || '未知玩家')} 加入了服务器`
        : `👋 ${this.escapeText(details.playerName || '未知玩家')} 离开了服务器`,
      joined ? 'mcserver.join.png' : 'mcserver.leave.png',
      [
        ...(joined ? [] : [this.field('游玩时长', details.playTime || '未知')]),
        this.field('当前在线', `${players.length}人`),
        `${this.field('玩家列表', '')}\n${playerList}`,
      ].join('\n'),
    );
  }

  buildDeviceMarkdown(details: DevicePushDetails): string {
    const cpuUsage = details.cpuUsage.toFixed(2);
    const memoryUsage = details.memoryUsage.toFixed(2);
    const applicationDetails = details.highCpuApplications.length
      ? details.highCpuApplications
        .map(
          (application) =>
            `- ${this.escapeText(application.name)} (PID ${application.pid})：${application.usage.toFixed(2)}%`,
        )
        .join('\n')
      : `未发现 CPU 占用率超过 ${details.highCpuApplicationThreshold}% 的应用`;
    const memory =
      details.memorySeverity === 'critical' ||
        details.memorySeverity === 'warning'
        ? `**${memoryUsage}%**`
        : `${memoryUsage}%`;

    return this.buildMessage(
      details.cpuSeverity === 'critical'
        ? '🔴 CPU 负载严重过高！'
        : '⚠️ CPU 高负载预警！',
      details.cpuSeverity === 'critical'
        ? 'device.extrahigh.png'
        : 'device.high.png',
      [
        this.fieldMarkdown(
          'CPU 使用率',
          details.cpuSeverity === 'critical'
            ? `**${cpuUsage}%**`
            : `${cpuUsage}%`,
        ),
        this.field('检测时间', details.checkedAt.toLocaleString('zh-CN')),
        [
          this.fieldMarkdown('内存占用', memory),
          this.field('已运行时间', this.formatUptime(details.uptimeSeconds)),
          this.field('系统', details.platform),
          this.field('CPU', details.cpuModel),
          this.field('核心数', details.cpuCount.toString()),
        ].join('\n'),
        `${this.field('高 CPU 应用', '')}\n${applicationDetails}`,
      ].join('\n'),
    );
  }

  private buildMemberMarkdown(payload: MemberWebhookPayload): string {
    const { action, member, repository, changes } = payload;
    if (action === 'added') {
      return this.buildMessage(
        `🤝 新增协作者 ${this.escapeText(member.login)}`,
        undefined,
        this.fieldMarkdown(
          '仓库',
          this.link(repository.name, repository.html_url),
        ),
      );
    }
    if (action === 'removed') {
      return this.buildMessage(
        `👋 移除协作者 ${this.escapeText(member.login)}`,
        undefined,
        this.fieldMarkdown(
          '仓库',
          this.link(repository.name, repository.html_url),
        ),
      );
    }
    if (action === 'edited') {
      return this.buildMessage(
        '🔧 协作者权限变更',
        undefined,
        [
          this.fieldMarkdown(
            '仓库',
            this.link(repository.name, repository.html_url),
          ),
          this.field('成员', member.login),
          this.field(
            '变更',
            `${changes?.permission?.from || '未知'} → ${changes?.permission?.to || '未知'}`,
          ),
        ].join('\n'),
      );
    }
    return this.buildMessage(
      '⚠️ 协作者未知操作',
      undefined,
      this.field('操作类型', action || '未知'),
    );
  }

  private buildIssuesMarkdown(details: RepoPushDetails): string {
    const payload = details.payload as IssuesWebhookPayload;
    const { action, issue, repository, sender } = payload;
    const title =
      action === 'opened'
        ? '🆕 新建 Issue'
        : `⚠️ ${this.issueAction(action)} Issue`;
    const fields = [
      this.fieldMarkdown(
        '标题',
        this.link(`[#${issue.number} ${issue.title}]`, issue.html_url),
      ),
      this.fieldMarkdown(
        '仓库',
        this.link(repository.full_name, repository.html_url),
      ),
      this.field(action === 'opened' ? '创建者' : '操作者', sender.login),
      this.field(
        action === 'opened' ? '创建时间' : '操作时间',
        action === 'opened'
          ? new Date(issue.created_at).toLocaleString('zh-CN')
          : details.receivedAt.toLocaleString('zh-CN'),
      ),
    ];
    if (action === 'opened' && issue.body) {
      fields.push(this.field('描述', this.truncate(issue.body, 200)));
    }
    return this.buildMessage(title, undefined, fields.join('\n'));
  }

  private buildReleaseMarkdown(details: RepoPushDetails): string {
    const payload = details.payload as ReleaseWebhookPayload;
    const { action, release, repository } = payload;
    const published = action === 'published';
    const fields = published
      ? [
        this.field('版本名称', release.name || release.tag_name),
        this.fieldMarkdown(
          '仓库',
          this.link(repository.name, repository.html_url),
        ),
        this.field(
          '发布时间',
          new Date(release.published_at || details.receivedAt).toLocaleString(
            'zh-CN',
          ),
        ),
        ...(release.body
          ? [this.field('发布说明', this.truncate(release.body, 300))]
          : []),
      ]
      : [
        this.fieldMarkdown(
          '版本',
          this.link(release.tag_name, release.html_url),
        ),
        this.fieldMarkdown(
          '仓库',
          this.link(repository.name, repository.html_url),
        ),
        this.field('操作时间', details.receivedAt.toLocaleString('zh-CN')),
      ];
    return this.buildMessage(
      published
        ? `🚀 ${this.link(release.tag_name, release.html_url, '')} 发布`
        : `⚠️ ${action} Release`,
      undefined,
      fields.join('\n'),
    );
  }

  private buildWorkflowMarkdown(details: RepoPushDetails): string {
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
    const image = succeeded
      ? 'workflow.success.png'
      : failed
        ? 'workflow.failed.png'
        : undefined;
    const title = succeeded ? '执行成功' : failed ? '执行失败' : '执行结束';
    return this.buildMessage(
      `${succeeded ? '✅' : failed ? '❌' : '⚠️'} ${this.link(workflowRun.name, workflowRun.html_url, '')} ${title}`,
      image,
      [
        this.field(
          '提交',
          this.shortenGitMessage(workflowRun.head_commit.message),
        ),
        this.fieldMarkdown(
          '仓库',
          this.link(repository.name, repository.html_url),
        ),
        this.fieldMarkdown(
          '分支',
          `\`${this.escapeText(workflowRun.head_branch)}\``,
        ),
        this.field('执行时长', this.formatDuration(duration)),
        ...(failed ? ['> ⚠️ 请及时检查并修复问题'] : []),
      ].join('\n'),
    );
  }

  private buildMessage(
    title: string,
    imagePath?: string,
    details?: string,
  ): string {
    const image = imagePath ? this.image(imagePath) : '';
    const heading = `# ${title}${image}`;
    return details ? `${heading}\n\n${details}` : heading;
  }

  private image(relativePath: string): string {
    const baseUrl = process.env.BASE_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      if (!this.missingBaseUrlWarned) {
        this.logger.warn(
          'BASE_URL is not configured; QQ Markdown images are disabled',
        );
        this.missingBaseUrlWarned = true;
      }
      return '';
    }
    return `![HeroImg #600px #200px](${baseUrl}/assets/img/push/${relativePath})`;
  }

  private gameImageSlug(gameName: string): string {
    const slug = gameName2GameChannel(gameName);
    return slug === 'genshin' || slug === 'star_rail' ? slug : 'fallback';
  }

  private field(label: string, value: string): string {
    return `> **${this.escapeText(label)}：**${value ? ` ${this.escapeText(value)}` : ''}`;
  }

  private fieldMarkdown(label: string, value: string): string {
    return `> **${this.escapeText(label)}：**${value ? ` ${value}` : ''}`;
  }

  private link(text: string, url: string, suffix = ''): string {
    return `[${this.escapeText(text)}](${url})${suffix}`;
  }

  private escapeText(value: string): string {
    return value
      .replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&')
      .replace(/\r?\n/g, ' ');
  }

  private truncate(value: string, length: number): string {
    const normalized = value.replace(/\r?\n/g, ' ').trim();
    return (
      normalized.substring(0, length) +
      (normalized.length > length ? '...' : '')
    );
  }

  private issueAction(action: string): string {
    const labels: Record<string, string> = {
      closed: '关闭',
      edited: '编辑',
      reopened: '重新打开',
      assigned: '分配',
      unassigned: '取消分配',
      labeled: '添加标签',
      unlabeled: '移除标签',
    };
    return labels[action] || action;
  }

  private formatHourMinute(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private formatDuration(seconds: number): string {
    return seconds > 0
      ? `${Math.floor(seconds / 60)}分${seconds % 60}秒`
      : '未知';
  }

  // TODO 迁移到 utils 里
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
