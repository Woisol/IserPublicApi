import { Injectable } from '@nestjs/common';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'crypto';

@Injectable()
export class QqbotSignatureService {
  getSecretFingerprint(): string {
    const secret = process.env.QQBOT_APP_SECRET || '';
    return createHash('sha256').update(secret).digest('hex').slice(0, 12);
  }

  verify(timestamp: string, body: Buffer, signature: string): boolean {
    const secret = process.env.QQBOT_APP_SECRET;
    if (!secret || !timestamp || !signature) return false;

    try {
      const seed = Buffer.from(
        secret.repeat(Math.ceil(32 / secret.length)).slice(0, 32),
      );
      const privateKey = createPrivateKey({
        key: Buffer.concat([
          Buffer.from('302e020100300506032b657004220420', 'hex'),
          seed,
        ]),
        format: 'der',
        type: 'pkcs8',
      });
      const message = Buffer.concat([Buffer.from(timestamp), body]);
      const decodedSignature = Buffer.from(signature, 'hex');
      return (
        decodedSignature.length === 64 &&
        verify(null, message, createPublicKey(privateKey), decodedSignature)
      );
    } catch {
      return false;
    }
  }

  createValidationSignature(eventTs: string, plainToken: string): string {
    const secret = process.env.QQBOT_APP_SECRET;
    if (!secret) throw new Error('QQBOT_APP_SECRET is required');
    const seed = Buffer.from(
      secret.repeat(Math.ceil(32 / secret.length)).slice(0, 32),
    );
    const privateKey = createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'),
        seed,
      ]),
      format: 'der',
      type: 'pkcs8',
    });
    return sign(null, Buffer.from(eventTs + plainToken), privateKey).toString(
      'hex',
    );
  }
}
