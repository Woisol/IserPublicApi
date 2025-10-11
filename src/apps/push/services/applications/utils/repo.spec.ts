import { shorttenGitMessage } from './repo';

describe('repo', () => {
  describe('shorttenGitMessage', () => {
    it('should remove emoji codes and extra spaces', () => {
      const input =
        '「 :sparkles: 新增 / feat, :bug: 修复 / fix 」: detail 信息';
      const output = shorttenGitMessage(input);
      expect(output).toBe('「 新增 / feat, 修复 / fix 」: detail 信息');
    });
    it('should remove unicode emojis', () => {
      const input =
        '「 ✨ 新增 / feat, ✏ 修改 / change 」: 补全 GitHub Workflow 响应属性……';
      const output = shorttenGitMessage(input);
      expect(output).toBe(
        '「 新增 / feat, 修改 / change 」: 补全 GitHub Workflow 响应属性……',
      );
    });
    it('should handle normal message', () => {
      const input = 'feat, fix: Normal commit message without emojis';
      const output = shorttenGitMessage(input);
      expect(output).toBe('feat, fix: Normal commit message without emojis');
    });
    it('should handle multi line message', () => {
      const input = `「 :sparkles: 新增 / feat, :bug: 修复 / fix 」: detail 信息

「 [AI] 纯粹 AI 产物 / Pure Vibe Coding 」
此提交全部或绝大部分由 AI 工具生成且未经人工审查，请谨慎使用。 / This commit is generated entirely or mostly by AI tools and has not been reviewed by humans, use with caution.`;
      const output = shorttenGitMessage(input);
      expect(output).toBe(`「 新增 / feat, 修复 / fix 」: detail 信息`);
    });
  });
});
