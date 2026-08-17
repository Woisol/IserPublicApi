/**
 * webhook 文档 https://docs.github.com/zh/webhooks/webhook-events-and-payloads
 * 微信进企微全员群以后不要退出会导致企微本体也退出()
 */
import { Injectable } from '@nestjs/common';
import type {
  GitHubWebhookPayload,
  IssuesWebhookPayload,
  MemberWebhookPayload,
  ReleaseWebhookPayload,
  WebhookProcessResult,
  WorkflowRunWebhookPayload,
} from '@app/apps/push/types/applications/repo';
import { GitHubWebhookEvent } from '@app/apps/push/types/applications/repo.runtime';
import { PushService } from '../../push.service';
import { CompactLogger } from '@app/common/utils/logger';

@Injectable()
export class PushApplicationsRepoService {
  /** 与 GitHub Repo 通知相关的逻辑 */
  private readonly logger = new CompactLogger(PushApplicationsRepoService.name);

  constructor(private readonly pushService: PushService) {}

  processWebhookEvent(
    event: GitHubWebhookEvent,
    payload: GitHubWebhookPayload,
  ): WebhookProcessResult {
    this.logger.log(`Processing GitHub webhook: ${event} - ${payload.action}`);

    try {
      switch (event) {
        case GitHubWebhookEvent.MEMBER:
          return this.handleMemberEvent(payload as MemberWebhookPayload);
        case GitHubWebhookEvent.ISSUES:
          return this.handleIssuesEvent(payload as IssuesWebhookPayload);
        case GitHubWebhookEvent.RELEASE:
          return this.handleReleaseEvent(payload as ReleaseWebhookPayload);
        case GitHubWebhookEvent.WORKFLOW_RUN:
          return this.handleWorkflowRunEvent(
            payload as WorkflowRunWebhookPayload,
          );
        default:
          return {
            success: false,
            message: `Unsupported event type: ${event as string}`,
            event,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing webhook: ${message}`, error);
      return {
        success: false,
        message: `Failed to process webhook: ${message}`,
        event,
        action: payload.action,
      };
    }
  }

  private handleMemberEvent(
    payload: MemberWebhookPayload,
  ): WebhookProcessResult {
    this.sendNotification(GitHubWebhookEvent.MEMBER, payload);
    return {
      success: true,
      message: `Member event processed: ${payload.action}`,
      event: GitHubWebhookEvent.MEMBER,
      action: payload.action,
      data: {
        member: payload.member.login,
        repository: payload.repository.full_name,
      },
    };
  }

  private handleIssuesEvent(
    payload: IssuesWebhookPayload,
  ): WebhookProcessResult {
    this.sendNotification(GitHubWebhookEvent.ISSUES, payload);
    return {
      success: true,
      message: `Issues event processed: ${payload.action}`,
      event: GitHubWebhookEvent.ISSUES,
      action: payload.action,
      data: {
        issue_number: payload.issue.number,
        issue_title: payload.issue.title,
        repository: payload.repository.full_name,
      },
    };
  }

  private handleReleaseEvent(
    payload: ReleaseWebhookPayload,
  ): WebhookProcessResult {
    this.sendNotification(GitHubWebhookEvent.RELEASE, payload);
    return {
      success: true,
      message: `Release event processed: ${payload.action}`,
      event: GitHubWebhookEvent.RELEASE,
      action: payload.action,
      data: {
        tag_name: payload.release.tag_name,
        release_name: payload.release.name,
        repository: payload.repository.name,
      },
    };
  }

  private handleWorkflowRunEvent(
    payload: WorkflowRunWebhookPayload,
  ): WebhookProcessResult {
    if (payload.action !== 'completed') {
      return {
        success: true,
        message: `Workflow action ignored: ${payload.action}`,
        event: GitHubWebhookEvent.WORKFLOW_RUN,
        action: payload.action,
      };
    }

    this.sendNotification(GitHubWebhookEvent.WORKFLOW_RUN, payload);
    return {
      success: true,
      message: `Workflow run event processed: ${payload.workflow_run.conclusion}`,
      event: GitHubWebhookEvent.WORKFLOW_RUN,
      action: payload.action,
      data: {
        workflow_name: payload.workflow_run.name,
        conclusion: payload.workflow_run.conclusion,
        branch: payload.workflow_run.head_branch,
        repository: payload.repository.full_name,
      },
    };
  }

  private sendNotification(
    event: GitHubWebhookEvent,
    payload: GitHubWebhookPayload,
  ): void {
    void this.pushService.sendMessage('repo', 'repo', {
      event,
      payload,
      receivedAt: new Date(),
    });
  }

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
