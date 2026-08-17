import { execFile } from 'child_process';
import {
  DeviceMonitorService,
  type HighCpuApplication,
} from './device.service';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

describe('DeviceMonitorService', () => {
  it('should include only Windows processes using more than 30% CPU', async () => {
    const execFileMock = execFile as unknown as jest.Mock;
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: null, result: { stdout: string }) => void,
      ) => {
        callback(null, {
          stdout: JSON.stringify([
            { name: 'busy-app', pid: 101, usage: 45.5 },
            { name: 'boundary-app', pid: 102, usage: 30 },
            { name: 'invalid-app', pid: 'not-a-pid', usage: 80 },
          ]),
        });
      },
    );

    const service = Object.create(
      DeviceMonitorService.prototype,
    ) as DeviceMonitorService;
    Object.defineProperty(service, 'logger', {
      value: { error: jest.fn() },
    });
    Object.defineProperty(service, 'highCpuApplicationThreshold', {
      value: 30,
    });

    const applications = await (
      service as unknown as {
        getHighCpuApplications(): Promise<HighCpuApplication[]>;
      }
    ).getHighCpuApplications();

    expect(applications).toEqual([{ name: 'busy-app', pid: 101, usage: 45.5 }]);
  });
});
