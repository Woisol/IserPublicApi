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

export function factoryGenshinLogURL(date: Date): URL {
  const logFileName = `better-genshin-impact${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.log`;
  return new URL(`${GENSHINLOGSURL}/${logFileName}`, BASELOGURL);
}

export function factoryStarrailLogURL(date: Date): URL {
  const logFileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
  return new URL(`${STARRAILLOGSURL}/${logFileName}`, BASELOGURL);
}
