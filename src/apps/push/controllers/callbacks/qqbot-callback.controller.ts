import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QqbotCallbackService } from '../../services/callbacks/qqbot-callback.service';
import { QqbotSignatureService } from '../../services/callbacks/qqbot-signature.service';
import { CompactLogger } from '@app/common/utils/logger';

@Controller('cb')
export class QqbotCallbackController {
  private readonly logger = new CompactLogger(QqbotCallbackController.name);

  constructor(
    private readonly callbackService: QqbotCallbackService,
    private readonly signatureService: QqbotSignatureService,
  ) {}

  @Post('qqmsg')
  async handle(
    @Req() request: Request & { rawBody?: Buffer },
    @Res() response: Response,
  ) {
    const rawBody =
      request.rawBody || Buffer.from(JSON.stringify(request.body ?? {}));
    const signature = request.headers['x-signature-ed25519'] as
      | string
      | undefined;
    const timestamp = request.headers['x-signature-timestamp'] as
      | string
      | undefined;
    const callbackAppId = request.headers['x-bot-appid'] as string | undefined;

    this.logger.debug(
      `QQ callback received: path=${request.path}, bodyBytes=${rawBody.length}, ` +
        `hasSignature=${Boolean(signature)}, hasTimestamp=${Boolean(timestamp)}, ` +
        `callbackAppId=${callbackAppId || '-'}, configuredAppId=${process.env.QQBOT_APP_ID || '-'}`,
    );

    let payload: {
      op: number;
      d: unknown;
      t?: string;
      id?: string;
      s?: number;
    };
    try {
      payload = JSON.parse(rawBody.toString()) as typeof payload;
    } catch (error) {
      this.logger.error('QQ callback payload JSON parse failed:', error);
      return response.status(400).json({ message: 'Invalid QQ callback JSON' });
    }
    this.logger.debug(
      `QQ callback payload: op=${payload.op}, type=${payload.t || '-'}, ` +
        `id=${payload.id || '-'}, sequence=${payload.s ?? '-'}`,
    );

    if (payload.op === 13) {
      const validation = payload.d as { plain_token: string; event_ts: string };
      this.logger.debug(
        `QQ callback validation requested: eventTs=${validation.event_ts}, ` +
          `secretFingerprint=${this.signatureService.getSecretFingerprint()}`,
      );
      try {
        const result = {
          plain_token: validation.plain_token,
          signature: this.signatureService.createValidationSignature(
            validation.event_ts,
            validation.plain_token,
          ),
        };
        this.logger.debug(
          `QQ callback validation response generated: ` +
            `signatureLength=${result.signature.length}, ` +
            `signatureFingerprint=${result.signature.slice(0, 12)}`,
        );
        return response.status(200).json(result);
      } catch (error) {
        this.logger.error('QQ callback validation failed:', error);
        return response
          .status(500)
          .json({ message: 'QQ callback validation is not configured' });
      }
    }

    const signatureValid = this.signatureService.verify(
      timestamp || '',
      rawBody,
      signature || '',
    );
    this.logger.debug(`QQ callback signature valid: ${signatureValid}`);
    if (!signatureValid) {
      this.logger.warn('QQ callback rejected because signature is invalid');
      return response.status(401).json({ message: 'Invalid QQ Bot signature' });
    }

    this.logger.debug('QQ callback ACK sent');
    response.status(200).json({ op: 12 });
    if (payload.op === 0) {
      try {
        await this.callbackService.handleEvent(payload);
        this.logger.debug('QQ callback event handled');
      } catch (error) {
        this.logger.error('QQ callback event handling failed:', error);
      }
    }
  }
}
