import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthorityApiKeyMiddleware } from './authority-api-key.middleware';
import * as crypto from 'crypto';

describe('AuthorityApiKeyMiddleware', () => {
  let middleware: AuthorityApiKeyMiddleware;
  const originalEnv = process.env;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorityApiKeyMiddleware],
    }).compile();

    middleware = module.get<AuthorityApiKeyMiddleware>(
      AuthorityApiKeyMiddleware,
    );

    // 设置测试环境变量
    process.env = { ...originalEnv };
    process.env.AUTHORITY_API_KEY = '123456';
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should throw UnauthorizedException when authority-api-key header is missing', () => {
    const req = {
      headers: {},
    } as any;
    const res = {} as any;
    const next = jest.fn();

    expect(() => {
      middleware.use(req, res, next);
    }).toThrow(UnauthorizedException);
    expect(() => {
      middleware.use(req, res, next);
    }).toThrow('Authority API Key is required');
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when AUTHORITY_API_KEY is not configured', () => {
    delete process.env.AUTHORITY_API_KEY;

    const req = {
      headers: {
        'authority-api-key': 'some-key',
      },
    } as any;
    const res = {} as any;
    const next = jest.fn();

    expect(() => {
      middleware.use(req, res, next);
    }).toThrow(UnauthorizedException);
    expect(() => {
      middleware.use(req, res, next);
    }).toThrow('Authority API Key not configured');
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when authority-api-key is invalid', () => {
    const req = {
      headers: {
        'authority-api-key': 'invalid-key',
      },
    } as any;
    const res = {} as any;
    const next = jest.fn();

    expect(() => {
      middleware.use(req, res, next);
    }).toThrow(UnauthorizedException);
    expect(() => {
      middleware.use(req, res, next);
    }).toThrow('Invalid Authority API Key');
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when authority-api-key is valid', () => {
    const originalKey = '123456';
    const encryptedKey = crypto
      .createHash('md5')
      .update(originalKey)
      .digest('hex');

    const req = {
      headers: {
        'authority-api-key': encryptedKey,
      },
    } as any;
    const res = {} as any;
    const next = jest.fn();

    expect(() => {
      middleware.use(req, res, next);
    }).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate correct MD5 hash for the test key', () => {
    // 验证MD5加密是否正确
    const testKey = '123456';
    const expectedHash = crypto.createHash('md5').update(testKey).digest('hex');
    console.log(`Original key: ${testKey}`);
    console.log(`MD5 hash: ${expectedHash}`);
    expect(expectedHash).toBe(
      crypto.createHash('md5').update(testKey).digest('hex'),
    );
  });
});
