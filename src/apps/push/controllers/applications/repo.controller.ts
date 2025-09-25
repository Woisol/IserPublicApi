import { Controller, Post, Req, Headers, Body } from '@nestjs/common';
import { type Request } from 'express';
import { PushService } from '@app/apps/push/services';
import { PushApplicationsRepoService } from '@app/apps/push/services/applications/repo.service';
import type { GitHubWebhookPayload } from '@app/apps/push/types/applications/repo.d';
import { GitHubWebhookEvent } from '../../types/applications/repo.runtime';
import { CompactLogger } from '@app/common/utils/logger';

@Controller('push')
export class ApplicationsRepoController {
  private readonly logger = new CompactLogger(ApplicationsRepoController.name);

  constructor(
    private readonly pushService: PushService,
    private readonly repoService: PushApplicationsRepoService,
  ) {}

  // @section-应用消息通道
  /**
   * Github Repo Webhook 通知接收端点
   * 接收 GitHub webhook 事件并处理
   */
  @Post('repo')
  handleGitHubWebhook(
    @Req() req: Request,
    @Headers('x-github-event') githubEvent: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: GitHubWebhookPayload,
  ) {
    this.logger.log(`Received GitHub webhook: ${githubEvent} (${deliveryId})`);

    try {
      // 验证 webhook 签名 (可选，建议在生产环境中启用)
      // const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
      // const isValid = this.repoService.verifyWebhookSignature(
      //   JSON.stringify(payload),
      //   signature,
      //   secret
      // );
      // if (!isValid) {
      //   return { success: false, message: 'Invalid signature' };
      // }

      // 检查是否为支持的事件类型
      const eventType = githubEvent as GitHubWebhookEvent;
      if (!Object.values(GitHubWebhookEvent).includes(eventType)) {
        this.logger.warn(`Unsupported GitHub event: ${githubEvent}`);
        return {
          success: false,
          message: `Unsupported event type: ${githubEvent}`,
        };
      }

      // 处理 webhook 事件
      const result = this.repoService.processWebhookEvent(eventType, payload);

      this.logger.log(`Webhook processing result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error handling GitHub webhook: ${errorMessage}`,
        error,
      );
      return {
        success: false,
        message: `Failed to process webhook: ${errorMessage}`,
      };
    }
  }
}
