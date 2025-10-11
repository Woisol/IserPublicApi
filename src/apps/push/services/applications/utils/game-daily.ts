import {
  GameLogFetchOption,
  GameLogFetchRawOption,
} from '@app/apps/push/types/applications/game-daily';

//! 在这里初始化会为空值()
// const GENSHINLOGSURL: string =
//   process.env.GAMELOG_GENSHINLOGSURL?.replace(/^\//, '')
//     ?.replace(/\/$/, '')
//     ?.concat('/') || '';

const gameLogURLMap: Record<string, (date: Date) => URL> = {
  Genshin: (date: Date): URL => {
    const GENSHINLOGSURL: string =
      process.env.GAMELOG_GENSHINLOGSURL?.replace(/^\//, '')
        ?.replace(/\/$/, '')
        ?.concat('/') || '';
    const logFileName = `better-genshin-impact${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.log`;
    return new URL(
      `${GENSHINLOGSURL}/${logFileName}`,
      process.env.GAMELOG_BASEURL || 'http://localhost',
    );
  },
  'Star Rail': (date: Date): URL => {
    const STARRAILLOGSURL: string =
      process.env.GAMELOG_STARRAILLOGSURL?.replace(/^\//, '')
        ?.replace(/\/$/, '')
        .concat('/') || '';
    const logFileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
    return new URL(
      `${STARRAILLOGSURL}/${logFileName}`,
      process.env.GAMELOG_BASEURL || 'http://localhost',
    );
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
  return gameName.toLowerCase().replace(/\s+/g, '_');
}

export function findGameLogFetchConfig(
  GameLogFetch: GameLogFetchRawOption[],
  gameName: string,
  date: Date = new Date(),
): GameLogFetchOption {
  const _option = GameLogFetch.find((g) => g.gameName === gameName);
  if (!_option) {
    throw new Error(`未找到游戏 ${gameName} 的日志配置`);
  }
  _option['logUrl'] = factoryGameLogURL(gameName, date);
  return _option as GameLogFetchOption;
}
