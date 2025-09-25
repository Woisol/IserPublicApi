/**
 * webhook 文档 https://docs.github.com/zh/webhooks/webhook-events-and-payloads
 * 微信进企微全员群以后不要退出会导致企微本体也退出()
 */
import { Injectable } from '@nestjs/common';
import {
  GitHubWebhookPayload,
  MemberWebhookPayload,
  IssuesWebhookPayload,
  ReleaseWebhookPayload,
  WorkflowRunWebhookPayload,
  WebhookProcessResult,
} from '../../types/applications/repo.d';
import { GitHubWebhookEvent } from '../../types/applications/repo.runtime';
import { WxwMarkdownInfo } from '../../types/wxw-webhook';
import { PushService } from '..';
import { CompactLogger } from '@app/common/utils/logger';

@Injectable()
export class PushApplicationsRepoService {
  /** 与 GitHub Repo 通知相关的逻辑 */
  private readonly logger = new CompactLogger(PushApplicationsRepoService.name);
  constructor(private readonly pushService: PushService) {}

  /**
   * 处理 GitHub Webhook 事件
   * @param event Webhook 事件类型
   * @param payload Webhook 载荷数据
   */
  processWebhookEvent(
    event: GitHubWebhookEvent,
    payload: GitHubWebhookPayload,
  ): WebhookProcessResult {
    this.logger.log(`Processing GitHub webhook: ${event} - ${payload.action}`);

    try {
      switch (event) {
        case GitHubWebhookEvent.MEMBER:
          return this._handleMemberEvent(payload as MemberWebhookPayload);

        case GitHubWebhookEvent.ISSUES:
          return this._handleIssuesEvent(payload as IssuesWebhookPayload);

        case GitHubWebhookEvent.RELEASE:
          return this._handleReleaseEvent(payload as ReleaseWebhookPayload);

        case GitHubWebhookEvent.WORKFLOW_RUN:
          return this._handleWorkflowRunEvent(
            payload as WorkflowRunWebhookPayload,
          );

        default: {
          const eventType = event as string;
          return {
            success: false,
            message: `Unsupported event type: ${eventType}`,
            event,
          };
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing webhook: ${errorMessage}`, error);
      return {
        success: false,
        message: `Failed to process webhook: ${errorMessage}`,
        event,
        action: payload.action,
      };
    }
  }

  /**
   * 处理协作者事件（添加、删除或更改权限）
   */
  private _handleMemberEvent(
    payload: MemberWebhookPayload,
  ): WebhookProcessResult {
    const { action, member, repository, changes } = payload;

    let markdownInfo: WxwMarkdownInfo;

    switch (action) {
      case 'added':
        markdownInfo = {
          type: 'Collaborate',
          title: `新增协作者 <font color="info">${member.login}</font>`,
          content: [{ 仓库: `[${repository.name}](${repository.html_url})` }],
        };
        break;

      case 'removed':
        markdownInfo = {
          type: 'Collaborate',
          title: `移除协作者 <font color="warning">${member.login}</font>`,
          content: [{ 仓库: `[${repository.name}](${repository.html_url})` }],
        };
        break;

      case 'edited': {
        const oldPermission = changes?.permission?.from || '未知';
        const newPermission = changes?.permission?.to || '未知';
        markdownInfo = {
          type: 'Collaborate',
          title: '权限变更',
          content: [
            { 仓库: `[${repository.name}](${repository.html_url})` },
            { 成员: member.login },
            { 变更: `${oldPermission} → ${newPermission}` },
          ],
        };
        break;
      }

      default:
        markdownInfo = {
          type: 'Collaborate',
          title: '未知操作',
          content: [{ 操作类型: action }],
        };
    }

    this.sendStructuredNotification(markdownInfo, payload);

    return {
      success: true,
      message: `Member event processed: ${action}`,
      event: GitHubWebhookEvent.MEMBER,
      action,
      data: { member: member.login, repository: repository.full_name },
    };
  }

  /**
   * 处理 Issue 事件
   */
  private _handleIssuesEvent(
    payload: IssuesWebhookPayload,
  ): WebhookProcessResult {
    const { action, issue, repository, sender } = payload;

    let markdownInfo: WxwMarkdownInfo;
    const issueUrl = issue.html_url;

    switch (action) {
      case 'opened':
        markdownInfo = {
          type: 'Issue',
          title: '新建 Issue',
          content: [
            { 标题: `[#${issue.number} ${issue.title}](${issueUrl})` },
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
        break;

      default:
        markdownInfo = {
          type: 'Issue',
          title: `${action} Issue`,
          content: [
            { 标题: `[#${issue.number} ${issue.title}](${issueUrl})` },
            { 仓库: `[${repository.full_name}](${repository.html_url})` },
            { 操作者: sender.login },
            { 操作时间: new Date().toLocaleString('zh-CN') },
          ],
        };
    }

    this.sendStructuredNotification(markdownInfo, payload);

    return {
      success: true,
      message: `Issues event processed: ${action}`,
      event: GitHubWebhookEvent.ISSUES,
      action,
      data: {
        issue_number: issue.number,
        issue_title: issue.title,
        repository: repository.full_name,
      },
    };
  }

  /**
   * 处理 Release 事件
   */
  private _handleReleaseEvent(
    payload: ReleaseWebhookPayload,
  ): WebhookProcessResult {
    const { action, release, repository } = payload;

    let markdownInfo: WxwMarkdownInfo;
    const releaseUrl = release.html_url;

    switch (action) {
      case 'published':
        markdownInfo = {
          type: 'Release',
          title: `<font color="info">[${release.tag_name}](${releaseUrl})</font> 发布`,
          content: [
            { 版本名称: release.name || release.tag_name },
            { 仓库: `[${repository.name}](${repository.html_url})` },
            {
              发布时间: new Date(
                release.published_at || Date.now(),
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
        break;

      default:
        markdownInfo = {
          type: 'Release',
          title: `${action} Release`,
          content: [
            { 版本: `[${release.tag_name}](${releaseUrl})` },
            { 仓库: `[${repository.name}](${repository.html_url})` },
            { 操作时间: new Date().toLocaleString('zh-CN') },
          ],
        };
    }

    this.sendStructuredNotification(markdownInfo, payload);

    return {
      success: true,
      message: `Release event processed: ${action}`,
      event: GitHubWebhookEvent.RELEASE,
      action,
      data: {
        tag_name: release.tag_name,
        release_name: release.name,
        repository: repository.name,
      },
    };
  }

  /**
   * 处理 Workflow 运行事件
   */
  private _handleWorkflowRunEvent(
    payload: WorkflowRunWebhookPayload,
  ): WebhookProcessResult {
    const { action, workflow_run, repository } = payload;

    // 只处理已完成的工作流
    if (action !== 'completed') {
      return {
        success: true,
        message: `Workflow action ignored: ${action}`,
        event: GitHubWebhookEvent.WORKFLOW_RUN,
        action,
      };
    }

    let message: WxwMarkdownInfo;
    const workflowUrl = workflow_run.html_url;
    const conclusion = workflow_run.conclusion;

    const duration =
      workflow_run.run_started_at && workflow_run.updated_at
        ? Math.round(
            (new Date(workflow_run.updated_at).getTime() -
              new Date(workflow_run.run_started_at).getTime()) /
              1000,
          )
        : 0;

    const durationText =
      duration > 0
        ? `${Math.floor(duration / 60)}分${duration % 60}秒`
        : '未知';

    if (conclusion === 'success') {
      message = {
        type: 'Workflow',
        title: `✅ [${workflow_run.name} ](${workflowUrl}) 执行成功`,
        content: [
          { 仓库: `[${repository.name}](${repository.html_url})` },
          { 分支: `\`${workflow_run.head_branch}\`` },
          { 执行时长: durationText },
        ],
      };
    } else if (conclusion === 'failure') {
      message = {
        type: 'Workflow',
        title: `❌ [${workflow_run.name}](${workflowUrl}) 执行失败`,
        content: [
          { 仓库: `[${repository.name}](${repository.html_url})` },
          { 分支: `\`${workflow_run.head_branch}\`` },
          { 执行时长: durationText },
          `⚠️ <font color="warning">请及时检查并修复问题</font>`,
        ],
      };
    }
    //     else {
    //       // 其他状态如 cancelled, skipped 等
    //       const statusEmoji =
    //         {
    //           cancelled: '🚫',
    //           skipped: '⏭️',
    //           neutral: '➖',
    //           timed_out: '⏰',
    //           action_required: '🔔',
    //         }[conclusion] || '❓';

    //       const statusText =
    //         {
    //           cancelled: '已取消',
    //           skipped: '已跳过',
    //           neutral: '中性',
    //           timed_out: '超时',
    //           action_required: '需要操作',
    //         }[conclusion] || conclusion;

    //       message = `## ${statusEmoji} 工作流${statusText}
    // > 工作流： [${workflow_run.name}](${workflowUrl})
    // > 仓库： [${repository.full_name}](${repository.html_url})
    // > 分支： \`${workflow_run.head_branch}\`
    // > 触发者： ${workflow_run.actor.login}
    // > 状态： ${statusEmoji} ${statusText}
    // > 时间： ${new Date(workflow_run.updated_at).toLocaleString('zh-CN')}`;
    //     }

    this.sendStructuredNotification(message);

    return {
      success: true,
      message: `Workflow run event processed: ${conclusion}`,
      event: GitHubWebhookEvent.WORKFLOW_RUN,
      action,
      data: {
        workflow_name: workflow_run.name,
        conclusion,
        branch: workflow_run.head_branch,
        repository: repository.full_name,
      },
    };
  }

  /**
   * 发送结构化 Markdown 通知消息
   */
  private sendStructuredNotification(
    markdownInfo: WxwMarkdownInfo,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload?: GitHubWebhookPayload,
  ): void {
    void this.pushService.sendMarkdownInfoMessage(markdownInfo, 'repo');
  }

  /**
   * 验证 GitHub Webhook 签名
   */
  verifyWebhookSignature(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signature: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _secret: string,
  ): boolean {
    // TODO: 实现 GitHub Webhook 签名验证
    // 使用 crypto.createHmac('sha256', secret) 验证签名
    return true; // 临时返回 true，实际应用中需要实现真正的验证逻辑
  }
}
