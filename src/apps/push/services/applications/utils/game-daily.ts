import { GameLogInfo } from '@app/apps/push/types/applications/game-daily';

const BASELOGURL = process.env.GAMELOG_BASEURL || 'http://localhost';

const GENSHINLOGSURL: string =
  process.env.GAMELOG_GENSHINLOGSURL?.replace(/^\//, '')
    ?.replace(/\/$/, '')
    ?.push('/') || '';

const STARRAILLOGSURL: string =
  process.env.GAMELOG_STARRAILLOGSURL?.replace(/^\//, '')
    ?.replace(/\/$/, '')
    ?.push('/') || '';

const gameLogURLMap: Record<string, (date: Date) => URL> = {
  Genshin: (date: Date): URL => {
    const logFileName = `better-genshin-impact${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.log`;
    return new URL(`${GENSHINLOGSURL}/${logFileName}`, BASELOGURL);
  },
  'Star Rail': (date: Date): URL => {
    const logFileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
    return new URL(`${STARRAILLOGSURL}/${logFileName}`, BASELOGURL);
  },
};

export function factoryGameLogURL(gameName: string, date: Date): URL {
  const factory = gameLogURLMap[gameName];
  if (!factory) {
    throw new Error(`未找到游戏 ${gameName} 的日志工厂`);
  }
  return factory(date);
}

export function gameName2GameChannel(gameName: string): string {
  return gameName.toLowerCase().replace(/\s+/g, '-');
}
