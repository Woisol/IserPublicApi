import { MarkdownMessageHelper } from '../src/apps/push/services/adapters/markdown-message-helper';

describe('QqbotMarkdownMessageHelper', () => {
  const originalBaseUrl = process.env.BASE_URL;

  beforeEach(() => {
    process.env.BASE_URL = 'https://push.example.test/';
  });

  afterAll(() => {
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;
  });

  it('builds the game message with a status image', () => {
    const helper = new MarkdownMessageHelper();

    const message = helper.buildGameDailyMarkdown({
      gameName: 'Genshin',
      status: 'finished',
      detail: [{ 剩余树脂: '120' }],
    });

    expect(message).toContain(
      '# ✅ Genshin 每日任务已完成![HeroImg #600px #200px](https://push.example.test/assets/img/push/games/genshin.finished.png)',
    );
    expect(message).toContain('> **剩余树脂：** 120');
  });

  it('uses the star rail slug and fallback image safely', () => {
    const helper = new MarkdownMessageHelper();

    expect(
      helper.buildGameDailyMarkdown({
        gameName: 'Star Rail',
        status: 'unfinished',
        detail: [],
      }),
    ).toContain('/games/star_rail.unfinished.png');
    expect(
      helper.buildGameDailyMarkdown({
        gameName: 'Unknown/Game',
        status: 'failed',
        detail: [],
        failureReason: '日志不存在',
      }),
    ).toContain('/games/fallback.failed.png');
  });

  it('builds weather and server messages with their matching images', () => {
    const helper = new MarkdownMessageHelper();
    const weather = helper.buildWeatherMarkdown({
      kind: 'minutely-rain',
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      precipitationTimeline: [0.8, 1.5],
      peakPrecipitation: 1.5,
      peakAt: new Date('2026-03-31T10:30:00+08:00'),
    });
    const server = helper.buildMcServerMarkdown({
      event: 'player_joined',
      playerName: 'Steve',
      currentPlayers: ['Steve'],
    });

    expect(weather).toContain('/weather.minutely.png');
    expect(weather).toContain('0.80mm|1.50mm');
    expect(server).toContain('/mcserver.join.png');
    expect(server).toContain('> **当前在线：** 1人');
  });

  it('keeps messages usable without BASE_URL', () => {
    delete process.env.BASE_URL;
    const helper = new MarkdownMessageHelper();

    const message = helper.buildGameDailyMarkdown({
      gameName: 'Genshin',
      status: 'finished',
      detail: [],
    });

    expect(message).toContain('# ✅ Genshin 每日任务已完成');
    expect(message).not.toContain('/assets/img/push/');
  });
});
