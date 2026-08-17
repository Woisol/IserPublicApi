import type {
  DevicePushDetails,
  GameDailyPushDetails,
  McServerPushDetails,
  RepoPushDetails,
  WeatherPushDetails,
} from './push-message';

export interface PushAdapter {
  getAvailableChannels(): string[];
  sendGameDaily(channel: string, details: GameDailyPushDetails): Promise<void>;
  sendWeather(channel: string, details: WeatherPushDetails): Promise<void>;
  sendRepo(channel: string, details: RepoPushDetails): Promise<void>;
  sendMcServer(channel: string, details: McServerPushDetails): Promise<void>;
  sendDevice(channel: string, details: DevicePushDetails): Promise<void>;
}
