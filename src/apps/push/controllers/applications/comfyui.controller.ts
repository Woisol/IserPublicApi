import { Controller, Get, Query } from '@nestjs/common';
import { PushApplicationsComfyUiService } from '../../services/applications/comfyui/comfyui.service';
import type { ComfyUiPushDetails } from '@app/apps/push/types/push-message';
import {
  parseQueryEnum,
  parseQueryNumber,
  parseQueryText,
} from '../utils/query';

@Controller('push/comfyui')
export class ComfyUiController {
  constructor(
    private readonly comfyUiService: PushApplicationsComfyUiService,
  ) {}

  @Get()
  processPush(@Query() query: Record<string, string>) {
    const details = {
      status: parseQueryEnum(query.status, 'status', ['success', 'error']),
      seed: parseQueryNumber(query.seed, 'seed'),
      elapsed: parseQueryNumber(query.elapsed, 'elapsed'),
      res: parseQueryNumber(query.res, 'res'),
      scale: parseQueryNumber(query.scale, 'scale'),
      duration: parseQueryNumber(query.duration, 'duration'),
      filename: parseQueryText(query.filename, 'filename'),
      path: parseQueryText(query.path, 'path'),
    } satisfies ComfyUiPushDetails;
    return this.comfyUiService.processPush(details);
  }
}
