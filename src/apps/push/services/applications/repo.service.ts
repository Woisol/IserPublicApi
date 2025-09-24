/**
 * webhook 文档 https://docs.github.com/zh/webhooks/webhook-events-and-payloads
 * 微信进企微全员群以后不要退出会导致企微本体也退出()
 */
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
    const { action, member, repository, changes } = payload;

    let message = '';

    switch (action) {
      case 'added':
        message = `「Collaborate」新增协作者 <font color="info">${member.login}</font>
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})`;
        break;

      case 'removed':
        message = `「Collaborate」移除协作者 <font color="warning">${member.login}</font>
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})`;
        break;

      case 'edited': {
        const oldPermission = changes?.permission?.from || '未知';
        const newPermission = changes?.permission?.to || '未知';
        message = `「Collaborate」权限变更
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})
> <font color="comment">成员：</font>${member.login}
> <font color="comment">变更：</font>${oldPermission} → ${newPermission}`;
        break;
      }
    }

    // 这里可以添加实际的通知发送逻辑，比如发送到企业微信、钉钉等
    this.sendNotification(message);

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

    let message = '';
    const issueUrl = issue.html_url;

    switch (action) {
      case 'opened':
        message = `「Issue」新建 Issue
> <font color="comment">标题：</font>[#${issue.number} ${issue.title}](${issueUrl})
> <font color="comment">仓库：</font>[${repository.full_name}](${repository.html_url})
> <font color="comment">创建者：</font>${sender.login}
> <font color="comment">创建时间：</font>${new Date(issue.created_at).toLocaleString('zh-CN')}`;
        break;

      //       case 'closed':
      //         message = `## ✅ 问题已关闭
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 关闭者： ${sender.login}
      // > 状态： ✅ 已完成
      // > 关闭时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'reopened':
      //         message = `## 🔄 问题重新打开
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 操作者： ${sender.login}
      // > 状态： 🔄 重新处理
      // > 操作时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'assigned':
      //         message = `## 👤 问题已分配
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 分配给： ${assignee?.login}
      // > 操作者： ${sender.login}
      // > 操作时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'unassigned':
      //         message = `## 👤 取消问题分配
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 操作者： ${sender.login}
      // > 操作时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'labeled':
      //         message = `## 🏷️ 问题添加标签
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 新标签： \`${label?.name}\`
      // > 操作者： ${sender.login}
      // > 操作时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'unlabeled':
      //         message = `## 🏷️ 问题移除标签
      // > 标题： [#${issue.number} ${issue.title}](${issueUrl})
      // > 仓库： [${repository.full_name}](${repository.html_url})
      // > 移除标签： \`${label?.name}\`
      // > 操作者： ${sender.login}
      // > 操作时间： ${new Date().toLocaleString('zh-CN')}`;
      //         break;

      //       case 'edited':
      //         message = `✏️ 问题已编辑\n标题: ${issue.title}\n编辑者: ${sender.login}\n仓库: ${repository.full_name}\n链接: ${issueUrl}`;
      //         break;
    }

    this.sendNotification(message);

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

    let message = '';
    const releaseUrl = release.html_url;

    switch (action) {
      case 'published':
        message = `「Release」<font color="info">[${release.tag_name}](${releaseUrl})</font> 发布
> <font color="comment">名称：</font>${release.name}
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})

${release.body ? '发布说明：\n' + release.body.substring(0, 200) + (release.body.length > 200 ? '...' : '') : ''}`;
        break;

        //       case 'unpublished':
        //         message = `「Release」版本 <font color="warning">${release.tag_name}</font> 取消发布
        // > 仓库： [${repository.name}](${repository.html_url})
        // > 操作者： ${sender.login}`;
        //         break;

        //       case 'created':
        //         message = `「Release」版本草稿 <font color="comment">${release.tag_name}</font> 创建
        // > 仓库： [${repository.name}](${repository.html_url})
        // > 创建者： ${sender.login}`;
        //         break;

        //       case 'edited':
        //         message = `「Release」版本 <font color="info">[${release.tag_name}](${releaseUrl})</font> 编辑
        // > 仓库： [${repository.name}](${repository.html_url})
        // > 编辑者： ${sender.login}`;
        //         break;

        //       case 'deleted':
        //         message = `「Release」版本 <font color="warning">${release.tag_name}</font> 删除
        // > 仓库： [${repository.name}](${repository.html_url})
        // > 删除者： ${sender.login}`;
        //         break;

        //       case 'prereleased':
        //         message = `「Release」预发布版本 <font color="info">[${release.tag_name}](${releaseUrl})</font>
        // > 名称： ${release.name}
        // > 仓库： [${repository.name}](${repository.html_url})
        // > 发布者： ${sender.login}

        // ${release.body ? '发布说明：\n' + release.body.substring(0, 200) + (release.body.length > 200 ? '...' : '') : ''}`;
        break;
    }

    this.sendNotification(message);

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

    let message = '';
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
      message = `「Workflow」✅ [${workflow_run.name} ](${workflowUrl}) 执行成功
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})
> <font color="comment">分支：</font>\`${workflow_run.head_branch}\`
> <font color="comment">执行时长：</font>${durationText}`;
    } else if (conclusion === 'failure') {
      message = `「Workflow」❌ [${workflow_run.name}](${workflowUrl}) 执行失败
> <font color="comment">仓库：</font>[${repository.name}](${repository.html_url})
> <font color="comment">分支：</font>\`${workflow_run.head_branch}\`
> <font color="comment">执行时长：</font>${durationText}

⚠️ <font color="warning">请及时检查并修复问题</font>`;
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

    this.sendNotification(message);

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload?: GitHubWebhookPayload,
  ): void {
    // 使用 void 操作符忽略 Promise
    void this.pushService.sendMarkdownMessage(message, 'repo');

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
