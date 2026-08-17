import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  RepoPushDetails,
  WeatherPushDetails,
} from './push-message';
import type { PushChannel, PushChannelTarget } from './push-message';

export interface PushAdapter {
  readonly name: PushChannel;
  getAvailableChannels(): string[];
  sendGameDaily(
    channel: PushChannelTarget,
    details: GameDailyPushDetails,
  ): Promise<void>;
  sendWeather(
    channel: PushChannelTarget,
    details: WeatherPushDetails,
  ): Promise<void>;
  sendRepo(channel: PushChannelTarget, details: RepoPushDetails): Promise<void>;
  sendMcServer(
    channel: PushChannelTarget,
    details: McServerPushDetails,
  ): Promise<void>;
  sendDevice(
    channel: PushChannelTarget,
    details: DevicePushDetails,
  ): Promise<void>;
}
