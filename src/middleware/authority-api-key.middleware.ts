import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class AuthorityApiKeyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 从请求头中获取加密的API密钥
    const encryptedApiKey = req.headers['authority-api-key'] as string;

    if (!encryptedApiKey) {
      throw new UnauthorizedException('Authority API Key is required');
    }

    // 获取环境变量中的原始API密钥
    const originalApiKey = process.env.AUTHORITY_API_KEY;

    if (!originalApiKey) {
      throw new UnauthorizedException('Authority API Key not configured');
    }

    // 对原始API密钥进行MD5加密
    const expectedEncryptedKey = crypto
      .createHash('md5')
      .update(originalApiKey)
      .digest('hex');

    // 比较加密后的密钥
    if (encryptedApiKey !== expectedEncryptedKey) {
      throw new UnauthorizedException('Invalid Authority API Key');
    }

    // 验证通过，继续处理请求
    next();
  }
}
