import type { GameLogDetailResult } from './applications/game-daily';
import type { McServerWebhookPayload } from './applications/mcserver';
import type { GitHubWebhookPayload } from './applications/repo';
import type { GitHubWebhookEvent } from './applications/repo.runtime';
import type { WeatherRainPeriod } from './applications/weather';

export type PushChannel = 'wxwork' | 'qqbot';

export type QqbotChannel =
  | string
  | {
      type: 'group' | 'user' | 'guild-channel';
      id: string;
    };

export type PushChannelTarget = string | QqbotChannel;

export type PushChannels = Partial<{
  wxwork: string;
  qqbot: QqbotChannel;
}>;

export type PushChannelInput = string | PushChannels;

export type GameDailyPushDetails =
  | {
      wakeupSuccessful: false;
    }
  | {
      gameName: string;
      status: 'finished' | 'unfinished' | 'failed';
      detail: GameLogDetailResult[];
      wakeupSuccessful?: true;
      failureReason?: string;
    };

export type WeatherPushDetails =
  | {
      kind: 'minutely-rain';
      startsAt: Date;
      precipitationTimeline: number[];
      peakPrecipitation: number;
      peakAt: Date;
    }
  | {
      kind: 'daily-rain';
      periods: WeatherRainPeriod[];
    };

export interface RepoPushDetails {
  event: GitHubWebhookEvent;
  payload: GitHubWebhookPayload;
  receivedAt: Date;
}

export type McServerPushDetails = McServerWebhookPayload;

export interface DevicePushDetails {
  cpuUsage: number;
  cpuSeverity: 'warning' | 'critical';
  memoryUsage: number;
  memorySeverity: 'normal' | 'warning' | 'critical';
  checkedAt: Date;
  platform: string;
  cpuModel: string;
  cpuCount: number;
  uptimeSeconds: number;
  highCpuApplications: Array<{
    name: string;
    pid: number;
    usage: number;
  }>;
  highCpuApplicationThreshold: number;
}

export interface PushMessageDetailsMap {
  'game-daily': GameDailyPushDetails;
  weather: WeatherPushDetails;
  repo: RepoPushDetails;
  mcserver: McServerPushDetails;
  device: DevicePushDetails;
}

export type PushMessageType = keyof PushMessageDetailsMap;
