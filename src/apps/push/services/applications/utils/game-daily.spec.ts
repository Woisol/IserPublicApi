import { factoryGenshinLogURL, factoryStarrailLogURL } from './game-daily';

describe('repo', () => {
  describe('shorttenGitMessage', () => {
    it('should factory genshin log info of 2025-10-11', () => {
      const output = factoryGenshinLogURL(new Date('2025-10-11'));
      expect(output.pathname).toContain('better-genshin-impact20251011.log');
    });
    it('should factory genshin log info of 2025-01-01', () => {
      const output = factoryGenshinLogURL(new Date('2025-01-01'));
      expect(output.pathname).toContain('better-genshin-impact20250101.log');
    });
    it('should factory starrail log info of 2025-10-11', () => {
      const output = factoryStarrailLogURL(new Date('2025-10-11'));
      expect(output.pathname).toContain('2025-10-11.log');
    });
    it('should factory starrail log info of 2025-01-01', () => {
      const output = factoryStarrailLogURL(new Date('2025-01-01'));
      expect(output.pathname).toContain('2025-01-01.log');
    });
  });
});
