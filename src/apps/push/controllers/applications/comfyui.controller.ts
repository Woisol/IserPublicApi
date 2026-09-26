import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
  @Post()
  processPush(
    @Query() query: Record<string, string>,
    @Body() body: Record<string, string>,
  ) {
    const input = body && Object.keys(body).length ? body : query;
    const details = {
      status: parseQueryEnum(input.status, 'status', ['success', 'error']),
      seed: parseQueryNumber(input.seed, 'seed'),
      elapsed: parseQueryNumber(input.elapsed, 'elapsed'),
      res: parseQueryNumber(input.res, 'res'),
      scale: parseQueryNumber(input.scale, 'scale'),
      duration: parseQueryNumber(input.duration, 'duration'),
      filename: parseQueryText(input.filename, 'filename'),
      path: parseQueryText(input.path, 'path'),
    } satisfies ComfyUiPushDetails;
    return this.comfyUiService.processPush(details);
  }
}
