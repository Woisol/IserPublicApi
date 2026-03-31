import type {
  HourlyWeatherData,
  MinutelyPrecipitationData,
  WeatherRainPeriod,
} from '../../../types/applications/weather.d';

export interface RainStartAnalysis {
  nextRainStartAt?: Date;
  message?: string;
}

export interface RainStopAnalysis {
  hasRainWithin2Hours: boolean;
  nextRainStopAt?: Date;
  noRainDurationMinutes?: number;
  shouldTrack: boolean;
  shouldNotifyNow: boolean;
  message?: string;
}

export function buildRainPeriods(
  hourly: HourlyWeatherData[],
  now: Date,
): WeatherRainPeriod[] {
  const wetHours = hourly
    .filter((item) => {
      const itemTime = new Date(item.fxTime);
      return (
        itemTime >= now &&
        (parseFloat(item.precip) > 0 || parseFloat(item.pop) > 30)
      );
    })
    .sort(
      (a, b) => new Date(a.fxTime).getTime() - new Date(b.fxTime).getTime(),
    );

  if (wetHours.length === 0) {
    return [];
  }

  const groups: WeatherRainPeriod[] = [];
  let start = new Date(wetHours[0].fxTime);
  let previous = new Date(wetHours[0].fxTime);

  for (let index = 1; index < wetHours.length; index += 1) {
    const current = new Date(wetHours[index].fxTime);
    const gapHours =
      (current.getTime() - previous.getTime()) / (60 * 60 * 1000);

    if (gapHours > 1) {
      groups.push({
        startTime: start,
        endTime: new Date(previous.getTime() + 60 * 60 * 1000),
      });
      start = current;
    }

    previous = current;
  }

  groups.push({
    startTime: start,
    endTime: new Date(previous.getTime() + 60 * 60 * 1000),
  });

  return groups;
}

export function analyzeRainStart(
  minutely: MinutelyPrecipitationData[],
  now: Date,
): RainStartAnalysis {
  const rainPoints = minutely.filter((item) => {
    const itemTime = new Date(item.fxTime);
    return (
      item.type === 'rain' && itemTime >= now && parseFloat(item.precip) > 0
    );
  });

  if (rainPoints.length === 0) {
    return {};
  }

  const firstRainTime = new Date(rainPoints[0].fxTime);
  const minutesUntilRain = Math.max(
    Math.round((firstRainTime.getTime() - now.getTime()) / (1000 * 60)),
    0,
  );
  const peakRainPoint = rainPoints.reduce((currentPeak, item) =>
    parseFloat(item.precip) > parseFloat(currentPeak.precip)
      ? item
      : currentPeak,
  );
  const maxPrecip = parseFloat(peakRainPoint.precip);
  const peakRainTimeText = formatHourMinute(new Date(peakRainPoint.fxTime));
  const precipTimeline = rainPoints
    .map((point) => `${parseFloat(point.precip).toFixed(2)}mm`)
    .join('|');

  return {
    nextRainStartAt: firstRainTime,
    message: `⚠️ 预计 ${minutesUntilRain}min 后开始下雨\n预报降雨量 ${precipTimeline}，峰值 ${maxPrecip.toFixed(2)}mm/5min（${peakRainTimeText}）`,
  };
}

export function analyzeRainStop(
  minutely: MinutelyPrecipitationData[],
  now: Date,
  trackedStopAt?: Date,
): RainStopAnalysis {
  const points = minutely
    .map((item) => ({
      time: new Date(item.fxTime),
      isRain: item.type === 'rain' && parseFloat(item.precip) > 0,
    }))
    .filter((item) => item.time >= now)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (points.length === 0) {
    return {
      hasRainWithin2Hours: false,
      shouldTrack: false,
      shouldNotifyNow: false,
    };
  }

  if (trackedStopAt && trackedStopAt.getTime() <= now.getTime()) {
    const noRainDurationMinutes = countDryMinutes(points, 0);
    if (noRainDurationMinutes >= 30) {
      return {
        hasRainWithin2Hours: true,
        nextRainStopAt: trackedStopAt,
        noRainDurationMinutes,
        shouldTrack: false,
        shouldNotifyNow: true,
        message: formatStopMessage(noRainDurationMinutes),
      };
    }
  }

  const firstWetIndex = points.findIndex((item) => item.isRain);
  if (firstWetIndex === -1) {
    return {
      hasRainWithin2Hours: false,
      shouldTrack: false,
      shouldNotifyNow: false,
    };
  }

  for (let index = firstWetIndex + 1; index <= points.length - 6; index += 1) {
    const sixBucketsDry = points
      .slice(index, index + 6)
      .every((item) => !item.isRain);
    if (!sixBucketsDry) {
      continue;
    }

    const nextRainStopAt = points[index].time;
    const noRainDurationMinutes = countDryMinutes(points, index);
    return {
      hasRainWithin2Hours: true,
      nextRainStopAt,
      noRainDurationMinutes,
      shouldTrack: true,
      shouldNotifyNow: false,
      message: formatStopMessage(noRainDurationMinutes),
    };
  }

  return {
    hasRainWithin2Hours: true,
    shouldTrack: true,
    shouldNotifyNow: false,
  };
}

function countDryMinutes(
  points: Array<{ time: Date; isRain: boolean }>,
  startIndex: number,
): number {
  let dryBuckets = 0;
  for (let index = startIndex; index < points.length; index += 1) {
    if (points[index].isRain) {
      break;
    }
    dryBuckets += 1;
  }

  return Math.min(dryBuckets * 5, 120);
}

function formatStopMessage(noRainDurationMinutes: number): string {
  if (noRainDurationMinutes >= 120) {
    return '✅ 预计雨已基本停止，未来至少 2h 无雨';
  }

  return `✅ 预计雨已基本停止，未来约 ${noRainDurationMinutes}min 无雨`;
}

function formatHourMinute(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
