import * as fs from 'fs';
import * as path from 'path';
import { BotKeyLoader } from '../src/apps/push/services/botkey-loader';

jest.mock(
  '@app/common/utils/logger',
  () => ({
    CompactLogger: class CompactLogger {
      warn = jest.fn();
      error = jest.fn();
    },
  }),
  { virtual: true },
);

describe('BotKeyLoader', () => {
  const originalCwd = process.cwd();
  const tempDirectory = path.join(originalCwd, '.tmp-botkey-loader-test');

  beforeEach(() => {
    fs.mkdirSync(tempDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(tempDirectory, 'bot-key.qqbot.json'),
      JSON.stringify({ alerts: 'group-openid' }),
      'utf-8',
    );
    process.chdir(tempDirectory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('loads bot keys from the adapter-specific file', () => {
    const loader = new BotKeyLoader();

    expect(loader.getBotKey('qqbot', 'alerts')).toBe('group-openid');
    expect(loader.getAvailableChannels('qqbot')).toEqual(['alerts']);
  });
});
