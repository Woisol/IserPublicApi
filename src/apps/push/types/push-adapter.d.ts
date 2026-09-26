import type {
  PushChannel,
  PushChannelInput,
  PushMessageDetailsMap,
  PushMessageType,
} from './push-message';

export interface PushAdapter {
  readonly name: PushChannel;
  getAvailableChannels(): string[];
  send<T extends PushMessageType>(
    type: T,
    channel: PushChannelInput | undefined,
    details: PushMessageDetailsMap[T],
  ): Promise<void>;
}
