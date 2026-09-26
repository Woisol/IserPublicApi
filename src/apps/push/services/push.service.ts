import { Inject, Injectable } from '@nestjs/common';
import type {
  PushChannelInput,
  PushMessageDetailsMap,
  PushMessageType,
} from '@app/apps/push/types/push-message';
import type { PushAdapter } from '@app/apps/push/types/push-adapter';
import { PUSH_ADAPTERS } from './adapters';

@Injectable()
export class PushService {
  private readonly adapter: PushAdapter;

  // 这里通过 Symbol 作为注入标识，是为了让 Nest 能按唯一 token 注入适配器数组。
  // 这样可以避免使用字符串时的重名冲突，也能把具体注入哪一个适配器的责任交给模块配置。
  constructor(@Inject(PUSH_ADAPTERS) adapters: PushAdapter[]) {
    const configuredAdapter = process.env.WEBHOOK_SEND_ADAPTER?.trim();
    if (!configuredAdapter) {
      throw new Error(
        'WEBHOOK_SEND_ADAPTER is required to start the push service',
      );
    }

    const adapter = adapters.find(
      (candidate) => candidate.name === configuredAdapter,
    );
    if (!adapter) {
      throw new Error(
        `Webhook send adapter '${configuredAdapter}' is not registered`,
      );
    }

    this.adapter = adapter;
  }

  getAvailableChannels(): string[] {
    return this.adapter.getAvailableChannels();
  }

  async sendMessage<T extends PushMessageType>(
    type: T,
    channels: PushChannelInput | undefined,
    details: PushMessageDetailsMap[T],
  ): Promise<void> {
    return this.adapter.send(type, channels, details);
  }
}
