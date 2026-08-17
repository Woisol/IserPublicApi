import { QqbotSignatureService } from '../src/apps/push/services/callbacks/qqbot-signature.service';

describe('QqbotSignatureService', () => {
  it('uses the QQ secret-derived Ed25519 key for validation signatures', () => {
    process.env.QQBOT_APP_SECRET = 'test-secret';
    const service = new QqbotSignatureService();

    const signature = service.createValidationSignature('123', 'token');

    expect(service.verify('123', Buffer.from('token'), signature)).toBe(true);
  });
});
