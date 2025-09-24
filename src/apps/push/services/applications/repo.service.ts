import { Injectable, Logger } from '@nestjs/common';
import {
  GitHubWebhookPayload,
  MemberWebhookPayload,
  IssuesWebhookPayload,
  ReleaseWebhookPayload,
  WorkflowRunWebhookPayload,
  WebhookProcessResult,
} from '../../types/applications/repo.d';
import { GitHubWebhookEvent } from '../../types/applications/repo.runtime';
import { PushService } from '..';

@Injectable()
export class PushApplicationsRepoService {
  /** 与 GitHub Repo 通知相关的逻辑 */
  private readonly logger = new Logger(PushApplicationsRepoService.name);
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
    const { action, member, repository, sender, changes } = payload;

    let message = '';

    switch (action) {
      case 'added':
        message = `🎉 ${member.login} 被 ${sender.login} 添加为 ${repository.full_name} 的协作者`;
        break;

      case 'removed':
        message = `👋 ${member.login} 被 ${sender.login} 从 ${repository.full_name} 移除协作者权限`;
        break;

      case 'edited': {
        const oldPermission = changes?.permission?.from || '未知';
        const newPermission = changes?.permission?.to || '未知';
        message = `🔧 ${sender.login} 将 ${member.login} 在 ${repository.full_name} 的权限从 ${oldPermission} 更改为 ${newPermission}`;
        break;
      }
    }

    // 这里可以添加实际的通知发送逻辑，比如发送到企业微信、钉钉等
    this.sendNotification(message, 'member', payload);

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
    const { action, issue, repository, sender, assignee, label } = payload;

    let message = '';
    const issueUrl = issue.html_url;

    switch (action) {
      case 'opened':
        message = `🐛 新问题创建\n标题: ${issue.title}\n创建者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'closed':
        message = `✅ 问题已关闭\n标题: ${issue.title}\n关闭者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'reopened':
        message = `🔄 问题已重新打开\n标题: ${issue.title}\n操作者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'assigned':
        message = `👤 问题已分配\n标题: ${issue.title}\n分配给: ${assignee?.login}\n操作者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'unassigned':
        message = `👤 问题分配已取消\n标题: ${issue.title}\n操作者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'labeled':
        message = `🏷️ 问题添加标签\n标题: ${issue.title}\n标签: ${label?.name}\n操作者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'unlabeled':
        message = `🏷️ 问题移除标签\n标题: ${issue.title}\n标签: ${label?.name}\n操作者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;

      case 'edited':
        message = `✏️ 问题已编辑\n标题: ${issue.title}\n编辑者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
        break;
    }

    this.sendNotification(message, 'issues', payload);

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
    const { action, release, repository, sender } = payload;

    let message = '';
    const releaseUrl = release.html_url;

    switch (action) {
      case 'published':
        message = `🚀 新版本发布\n版本: ${release.tag_name}\n名称: ${release.name}\n发布者: ${release.author.login}\n仓库: ${repository.full_name}\n链接: ${releaseUrl}`;
        break;

      case 'unpublished':
        message = `📦 版本取消发布\n版本: ${release.tag_name}\n操作者: ${sender.login}\n仓库: ${repository.full_name}`;
        break;

      case 'created':
        message = `📝 版本草稿创建\n版本: ${release.tag_name}\n创建者: ${sender.login}\n仓库: ${repository.full_name}`;
        break;

      case 'edited':
        message = `✏️ 版本信息已编辑\n版本: ${release.tag_name}\n编辑者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${releaseUrl}`;
        break;

      case 'deleted':
        message = `🗑️ 版本已删除\n版本: ${release.tag_name}\n删除者: ${sender.login}\n仓库: ${repository.full_name}`;
        break;

      case 'prereleased':
        message = `🧪 预发布版本\n版本: ${release.tag_name}\n发布者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${releaseUrl}`;
        break;
    }

    this.sendNotification(message, 'release', payload);

    return {
      success: true,
      message: `Release event processed: ${action}`,
      event: GitHubWebhookEvent.RELEASE,
      action,
      data: {
        tag_name: release.tag_name,
        release_name: release.name,
        repository: repository.full_name,
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

    let message = '';
    const workflowUrl = workflow_run.html_url;
    const conclusion = workflow_run.conclusion;

    if (conclusion === 'success') {
      message = `✅ 工作流执行成功\n工作流: ${workflow_run.name}\n分支: ${workflow_run.head_branch}\n触发者: ${workflow_run.actor.login}\n仓库: ${repository.full_name}\n链接: ${workflowUrl}`;
    } else if (conclusion === 'failure') {
      message = `❌ 工作流执行失败\n工作流: ${workflow_run.name}\n分支: ${workflow_run.head_branch}\n触发者: ${workflow_run.actor.login}\n仓库: ${repository.full_name}\n链接: ${workflowUrl}`;
    } else {
      // 其他状态如 cancelled, skipped 等
      const statusEmoji =
        {
          cancelled: '🚫',
          skipped: '⏭️',
          neutral: '➖',
          timed_out: '⏰',
          action_required: '🔔',
        }[conclusion] || '❓';

      message = `${statusEmoji} 工作流: ${conclusion}\n工作流: ${workflow_run.name}\n分支: ${workflow_run.head_branch}\n触发者: ${workflow_run.actor.login}\n仓库: ${repository.full_name}\n链接: ${workflowUrl}`;
    }

    this.sendNotification(message, 'workflow', payload);

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
   * 发送通知消息（这里可以根据实际需求对接不同的通知服务）
   */
  private sendNotification(
    message: string,
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: GitHubWebhookPayload,
  ): void {
    this.pushService.sendMarkdownMessage(message);

    // TODO: 在这里添加实际的通知发送逻辑
    // 例如：
    // - 发送到企业微信群
    // - 发送到钉钉群
    // - 发送邮件
    // - 发送到 Slack
    // - 存储到数据库

    // 示例：可以调用其他服务来发送通知
    // await this.wxMessageService.sendMessage(message);
    // await this.emailService.sendEmail(message);
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
