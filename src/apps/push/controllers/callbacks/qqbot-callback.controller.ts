import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QqbotCallbackService } from '../../services/callbacks/qqbot-callback.service';
import { QqbotSignatureService } from '../../services/callbacks/qqbot-signature.service';

@Controller('cb')
export class QqbotCallbackController {
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
      request.rawBody || Buffer.from(JSON.stringify(request.body));
    const payload = JSON.parse(rawBody.toString()) as {
      op: number;
      d: unknown;
      t?: string;
      id?: string;
      s?: number;
    };

    if (payload.op === 13) {
      const validation = payload.d as { plain_token: string; event_ts: string };
      return response.json({
        plain_token: validation.plain_token,
        signature: this.signatureService.createValidationSignature(
          validation.event_ts,
          validation.plain_token,
        ),
      });
    }

    const signature = request.headers['x-signature-ed25519'] as string;
    const timestamp = request.headers['x-signature-timestamp'] as string;
    if (!this.signatureService.verify(timestamp, rawBody, signature)) {
      return response.status(401).json({ message: 'Invalid QQ Bot signature' });
    }

    response.json({ op: 12 });
    if (payload.op === 0) {
      await this.callbackService.handleEvent(payload);
    }
  }
}
