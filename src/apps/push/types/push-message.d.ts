export type PushChannel = 'wxwork' | 'qqbot';

export type PushChannels = Partial<Record<PushChannel, string>>;

export type PushDetailContent = (
  | string
  | Record<string, string | Record<string, string>>
)[];

export interface StructuredPushDetails {
  type?: string;
  title: string;
  content: PushDetailContent;
}

export interface GameDailyPushDetails extends StructuredPushDetails {}

export interface WeatherPushDetails {
  message: string;
}

export interface RepoPushDetails extends StructuredPushDetails {}

export interface McServerPushDetails extends StructuredPushDetails {
  markdown?: string;
}

export interface DevicePushDetails extends StructuredPushDetails {}

export interface PushMessageDetailsMap {
  'game-daily': GameDailyPushDetails;
  weather: WeatherPushDetails;
  repo: RepoPushDetails;
  mcserver: McServerPushDetails;
  device: DevicePushDetails;
}

export type PushMessageType = keyof PushMessageDetailsMap;
