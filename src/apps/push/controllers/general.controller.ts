import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PushService } from '../services';
import type { GeneralPushDetails } from '../types/push-message';

type GeneralQuery = {
  title?: string;
  pic?: string;
  details?: string;
};

@Controller('push/general')
export class GeneralController {
  constructor(private readonly pushService: PushService) {}

  @Get()
  sendByQuery(@Query() query: GeneralQuery) {
    return this.pushService.sendMessage(
      'general',
      'general',
      this.parseDetails(query),
    );
  }

  @Post()
  sendByBody(@Body() body: GeneralPushDetails) {
    return this.pushService.sendMessage('general', 'general', body);
  }

  private parseDetails(query: GeneralQuery): GeneralPushDetails {
    if (!query.title)
      throw new Error('Missing required query parameter: title');
    let details: GeneralPushDetails['details'];
    if (query.details) {
      try {
        const parsed: unknown = JSON.parse(query.details);
        details =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, string>)
            : query.details;
      } catch {
        details = query.details;
      }
    }
    return { title: query.title, pic: query.pic, details };
  }
}
