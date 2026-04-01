import type {
  HourlyWeatherData,
  MinutelyPrecipitationData,
  WeatherRainPeriod,
} from '../../../types/applications/weather.d';
import { formatLocalTime } from '../utils/time';

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

/**
 * 根据未来小时级天气数据初筛降雨时间段
 * @param hourly 小时级天气数据列表
 * @param now 当前时间
 * @returns 未来降雨时间段列表
 */
export function buildRainPeriods(
  hourly: HourlyWeatherData[],
  now: Date,
): WeatherRainPeriod[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // 到明天 1 点为止
  tomorrow.setHours(1, 0, 0, 0);

  const wetHours = hourly
    .filter((item) => {
      const itemTime = new Date(item.fxTime);
      const itemEndTime = new Date(itemTime.getTime() + 60 * 60 * 1000);
      return (
        itemEndTime > now &&
        itemTime < tomorrow &&
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

  // 传统 for 算法，合并间隔 1h 内的降雨段
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

/**
 * 根据未来分钟级降水数据预测开始降雨时间点
 * @param minutely 分钟级降水数据列表
 * @param now 当前时间
 * @returns 预测的降雨开始时间
 */
export function analyzeRainStart(
  minutely: MinutelyPrecipitationData[],
  now: Date,
): RainStartAnalysis {
  const rainPoints = minutely.filter((item) => {
    const itemTime = new Date(item.fxTime);
    // 原来还有 rain | snow 的数据
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
  const peakRainTimeText = formatLocalTime(new Date(peakRainPoint.fxTime));
  const precipTimeline = rainPoints
    .map((point) => `${parseFloat(point.precip).toFixed(2)}mm`)
    .join('|');

  // 应该在外面构建信息……
  return {
    nextRainStartAt: firstRainTime,
    message: `⚠️ 预计 ${minutesUntilRain}min 后开始下雨\n预报降雨量 ${precipTimeline}，峰值 ${maxPrecip.toFixed(2)}mm/5min（${peakRainTimeText}）`,
  };
}

/**
 * 根据未来分钟级降水数据预测停止降雨时间点
 * @param minutely 分钟级降水数据列表
 * @param now 当前时间
 * @param trackedStopAt 已经在跟踪的预计停止降雨时间（如果有）
 * @returns 预测的降雨停止时间和相关信息
 */
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

  // 如果已经在跟踪一个预计停止降雨时间且已经到达，立刻验证后直接返回发送通知
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
  // 无语(雨)
  if (firstWetIndex === -1) {
    return {
      hasRainWithin2Hours: false,
      shouldTrack: false,
      shouldNotifyNow: false,
    };
  }

  for (let index = firstWetIndex + 1; index <= points.length - 6; index += 1) {
    // 未来 6 * 5 个分钟无语
    const sixBucketsDry = points
      .slice(index, index + 6)
      // !.every
      .every((item) => !item.isRain);
    if (!sixBucketsDry) {
      continue;
    }

    // 直到发现足够长无语时间段，进入这里
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

  // 同样返回，但少了具体停雨时间数据
  return {
    hasRainWithin2Hours: true,
    shouldTrack: true,
    shouldNotifyNow: false,
  };
}

function countDryMinutes(
  points: Array<{ time: Date; isRain: boolean }>,
  startIndex: number = 0,
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
