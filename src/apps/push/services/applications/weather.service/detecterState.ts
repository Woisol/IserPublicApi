import type {
  WeatherRainPeriod,
  WeatherRuntimeStatus,
  WeatherStartMode,
  WeatherStopMode,
} from '../../../types/applications/weather.d';

export interface WeatherDetectorState {
  startMode: WeatherStartMode;
  stopMode: WeatherStopMode;
  nextStartCheckAt?: Date;
  nextStopCheckAt?: Date;
  nextRainStartAt?: Date;
  nextRainStopAt?: Date;
  rainPeriods: WeatherRainPeriod[];
  plannedDate?: string;
  lastSentStartKey?: string;
  lastSentStopKey?: string;
}

export class WeatherDetectorStateStore {
  private state: WeatherDetectorState = {
    startMode: 'idle',
    stopMode: 'off',
    rainPeriods: [],
  };

  getSnapshot(): WeatherRuntimeStatus {
    return { ...this.state };
  }

  getRawState(): WeatherDetectorState {
    return this.state;
  }

  setDailyPlan(plannedDate: string, rainPeriods: WeatherRainPeriod[]) {
    this.state.plannedDate = plannedDate;
    this.state.rainPeriods = rainPeriods;
  }

  setStartTracking(
    mode: WeatherStartMode,
    nextCheckAt?: Date,
    nextRainStartAt?: Date,
  ) {
    this.state.startMode = mode;
    this.state.nextStartCheckAt = nextCheckAt;
    this.state.nextRainStartAt = nextRainStartAt;
  }

  setStopTracking(
    mode: WeatherStopMode,
    nextCheckAt?: Date,
    nextRainStopAt?: Date,
  ) {
    this.state.stopMode = mode;
    this.state.nextStopCheckAt = nextCheckAt;
    this.state.nextRainStopAt = nextRainStopAt;
  }

  clearStopTracking() {
    this.state.stopMode = 'off';
    this.state.nextStopCheckAt = undefined;
    this.state.nextRainStopAt = undefined;
  }

  rememberStartAlert(alertTime: Date) {
    this.state.lastSentStartKey = alertTime.toISOString();
  }

  rememberStopAlert(stopTime: Date) {
    this.state.lastSentStopKey = stopTime.toISOString();
  }

  hasSentStartAlert(alertTime: Date): boolean {
    return this.state.lastSentStartKey === alertTime.toISOString();
  }

  hasSentStopAlert(stopTime: Date): boolean {
    return this.state.lastSentStopKey === stopTime.toISOString();
  }
}
